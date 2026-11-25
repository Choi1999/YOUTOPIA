"""Four real training implementations. Safe JSON/NPZ/safetensors artifacts only."""
import math
import random
import time
from pathlib import Path
import numpy as np
from .common import file_hash, read, seal, verify, write
from .dataset import load

KINDS = ('tfidf', 'textcnn', 'frozen', 'full')


def targets(records, labels):
    return np.array([[float(label in row['labels']) for label in labels] for row in records], dtype=np.float32)


def checked(scores, count, labels):
    values = np.asarray(scores, dtype=np.float64)
    if values.shape != (count, len(labels)) or not np.isfinite(values).all() or (values < 0).any() or (values > 1).any():
        raise ValueError('INVALID_MODEL_SCORES')
    return values


def decode(scores, threshold, labels):
    values = checked(scores, len(scores), labels)
    if not math.isfinite(threshold) or not 0 < threshold < 1:
        raise ValueError('INVALID_THRESHOLD')
    units = list(dict.fromkeys(label.split('::')[0] for label in labels))
    if any('.' not in unit for unit in units):
        raise ValueError('FINE_TARGET_LABEL_SCHEMA_REQUIRED')
    if any(label.split('::')[-1] not in ('긍정', '부정') for label in labels):
        raise ValueError('V05_BINARY_POLARITY_SCHEMA_REQUIRED')
    return (values >= threshold).astype(np.int8)


def metrics(truth, predicted, labels):
    from sklearn.metrics import f1_score, precision_recall_fscore_support
    precision, recall, f1, support = precision_recall_fscore_support(truth, predicted, average=None, zero_division=0)
    return {
        'reviews': len(truth), 'macro_f1_all_labels_zero_division_0': float(np.mean(f1)),
        'classification_unit': 'leaf_id', 'label_count': len(labels),
        'macro_f1_supported': float(np.mean(f1[support > 0])) if (support > 0).any() else None,
        'micro_f1': float(f1_score(truth, predicted, average='micro', zero_division=0)),
        'exact_match': float(np.all(truth == predicted, axis=1).mean()),
        'per_label': [{'label': label, 'support': int(s), 'predicted': int(predicted[:, i].sum()),
                       'precision': float(p) if predicted[:, i].any() else None,
                       'recall': float(r) if s else None, 'f1': float(f) if s else None,
                       'tp': int(((truth[:, i] == 1) & (predicted[:, i] == 1)).sum()),
                       'fp': int(((truth[:, i] == 0) & (predicted[:, i] == 1)).sum()),
                       'fn': int(((truth[:, i] == 1) & (predicted[:, i] == 0)).sum())}
                      for i, (label, p, r, f, s) in enumerate(zip(labels, precision, recall, f1, support))],
        'score_interpretation': 'uncalibrated decision scores; not calibrated probabilities',
    }


def select_threshold(truth, scores, labels):
    candidates = [{'threshold': threshold, 'metrics': metrics(truth, decode(scores, threshold, labels), labels)}
                  for threshold in (.3, .5, .7)]
    best = max(candidates, key=lambda c: (c['metrics']['macro_f1_all_labels_zero_division_0'],
                                         c['metrics']['micro_f1'], -abs(c['threshold'] - .5)))
    return best, candidates


def constant_scores(scores, constants):
    result = np.asarray(scores).copy()
    for index, constant in enumerate(constants):
        if constant is not None:
            result[:, index] = constant
    return result


def fit_tfidf(train, truth, target, seed):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5), max_features=80000, sublinear_tf=True)
    matrix = vectorizer.fit_transform([row['text'] for row in train])
    coefficients, biases, constants = [], [], []
    for i in range(truth.shape[1]):
        unique = np.unique(truth[:, i])
        if len(unique) == 1:
            coefficients.append(np.zeros(matrix.shape[1])); biases.append(0.)
            constants.append(float(unique[0]))
        else:
            classifier = LogisticRegression(solver='liblinear', max_iter=1500, random_state=seed)
            classifier.fit(matrix, truth[:, i])
            if int(classifier.n_iter_[0]) >= 1500:
                raise ValueError('BASELINE_DID_NOT_CONVERGE')
            coefficients.append(classifier.coef_[0]); biases.append(classifier.intercept_[0]); constants.append(None)
    np.savez(target / 'baseline.npz', coefficients=np.asarray(coefficients), biases=np.asarray(biases), idf=vectorizer.idf_)
    write(target / 'vocabulary.json', {token: int(index) for token, index in vectorizer.vocabulary_.items()})
    return constants


def tfidf_bundle(root):
    from sklearn.feature_extraction.text import TfidfVectorizer
    root = Path(root)
    vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5), sublinear_tf=True,
                                 vocabulary=read(root / 'vocabulary.json'))
    with np.load(root / 'baseline.npz', allow_pickle=False) as weights:
        vectorizer.idf_ = weights['idf']
        return vectorizer, weights['coefficients'], weights['biases']


def tfidf_scores(root, texts, bundle=None):
    from scipy.special import expit
    vectorizer, coefficients, biases = bundle if bundle is not None else tfidf_bundle(root)
    return expit(vectorizer.transform(texts) @ coefficients.T + biases)


def network(kind, base, label_count, pretrained):
    import torch
    from torch import nn
    from transformers import AutoConfig, AutoModel

    class Classifier(nn.Module):
        def __init__(self):
            super().__init__()
            config = AutoConfig.from_pretrained(base, local_files_only=True, trust_remote_code=False)
            if config.model_type != 'electra':
                raise ValueError('ELECTRA_REQUIRED')
            if kind == 'textcnn':
                self.embedding = nn.Embedding(config.vocab_size, 128, padding_idx=config.pad_token_id)
                self.convs = nn.ModuleList([nn.Conv1d(128, 100, k) for k in (3, 4, 5)])
                hidden_size = 300
            else:
                self.encoder = (AutoModel.from_pretrained(base, local_files_only=True, trust_remote_code=False,
                                                        use_safetensors=True) if pretrained else AutoModel.from_config(config))
                hidden_size = config.hidden_size
                if kind == 'frozen':
                    self.encoder.requires_grad_(False)
            self.dropout = nn.Dropout(.5 if kind == 'textcnn' else .1)
            self.head = nn.Linear(hidden_size, label_count)

        def train(self, mode=True):
            super().train(mode)
            if kind == 'frozen':
                self.encoder.eval()
            return self

        def forward(self, inputs):
            if kind != 'textcnn':
                hidden = self.encoder(**inputs).last_hidden_state[:, 0]
            else:
                hidden = self.embedding(inputs['input_ids']).transpose(1, 2)
                mask = inputs['attention_mask']
                if hidden.shape[-1] < 5:
                    pad = 5 - hidden.shape[-1]
                    hidden = nn.functional.pad(hidden, (0, pad)); mask = nn.functional.pad(mask, (0, pad))
                pooled = []
                for conv in self.convs:
                    valid = mask.unfold(1, conv.kernel_size[0], 1).all(-1)
                    values = torch.relu(conv(hidden)).masked_fill(~valid.unsqueeze(1), -1e4).amax(-1)
                    pooled.append(torch.where(valid.any(-1, keepdim=True), values, torch.zeros_like(values)))
                hidden = torch.cat(pooled, dim=1)
            return self.head(self.dropout(hidden))

    return Classifier()


def token_batch(tokenizer, texts, max_tokens, device):
    batch = tokenizer(texts, padding=True, truncation=False, return_tensors='pt')
    if batch['input_ids'].shape[1] > max_tokens:
        raise ValueError('LONG_BODY_HELD_NO_TRUNCATION')
    return {key: value.to(device) for key, value in batch.items()}


def neural_scores(model, tokenizer, texts, max_tokens, device, batch_size):
    import torch
    model.eval()
    result = []
    with torch.inference_mode():
        for start in range(0, len(texts), batch_size):
            batch = token_batch(tokenizer, texts[start:start + batch_size], max_tokens, device)
            result.append(model(batch).sigmoid().cpu().numpy())
    return np.concatenate(result)


def fit(dataset, base, destination, kind, seed=42, epochs=5, batch_size=16, lr=None, device='cpu', patience=2):
    import torch
    from torch import nn
    from safetensors.torch import save_file
    from transformers import AutoConfig, AutoTokenizer
    if kind not in KINDS or not 1 <= epochs <= 100 or not 1 <= batch_size <= 256 or not 1 <= patience <= 100:
        raise ValueError('INVALID_TRAINING_CONFIGURATION')
    lr = lr if lr is not None else (2e-5 if kind == 'full' else 1e-3)
    if not math.isfinite(lr) or not 0 < lr <= 1:
        raise ValueError('INVALID_LEARNING_RATE')
    train, metadata = load(dataset, 'train'); val, _ = load(dataset, 'validation')
    verify(base)
    if metadata['base_sha256'] != file_hash(Path(base) / 'READY.json'):
        raise ValueError('BASE_IDENTITY_CHANGED')
    if {r['appid'] for r in train} & {r['appid'] for r in val}:
        raise ValueError('GAME_LEAKAGE')
    labels = metadata['labels']; truth = targets(train, labels); val_truth = targets(val, labels)
    constants = [float(v[0]) if len(v := np.unique(truth[:, i])) == 1 else None for i in range(len(labels))]
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    if device not in ('cpu', 'cuda') or (device == 'cuda' and not torch.cuda.is_available()):
        raise ValueError('REQUESTED_DEVICE_UNAVAILABLE')
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    tokenizer = AutoTokenizer.from_pretrained(base, local_files_only=True, trust_remote_code=False)
    tokenizer.save_pretrained(target / 'tokenizer')
    AutoConfig.from_pretrained(base, local_files_only=True, trust_remote_code=False).save_pretrained(target / 'encoder_config')
    started = time.perf_counter(); history = []
    if kind == 'tfidf':
        constants = fit_tfidf(train, truth, target, seed)
        scores = constant_scores(tfidf_scores(target, [r['text'] for r in val]), constants)
        chosen, candidates = select_threshold(val_truth, scores, labels)
        best_epoch = 1
    else:
        model = network(kind, base, len(labels), pretrained=True).to(device)
        optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=lr, weight_decay=.01)
        criterion = nn.BCEWithLogitsLoss(); best = -1.; stale = 0
        for epoch in range(1, epochs + 1):
            model.train(); total_loss = 0.
            indices = np.random.permutation(len(train))
            for start in range(0, len(train), batch_size):
                take = indices[start:start + batch_size]
                inputs = token_batch(tokenizer, [train[i]['text'] for i in take], metadata['max_tokens'], device)
                expected = torch.tensor(truth[take], device=device)
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(model(inputs), expected)
                if not torch.isfinite(loss):
                    raise ValueError('NONFINITE_TRAINING_LOSS')
                loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 1., error_if_nonfinite=True); optimizer.step()
                total_loss += loss.item() * len(take)
            scores = constant_scores(neural_scores(model, tokenizer, [r['text'] for r in val],
                                      metadata['max_tokens'], device, batch_size), constants)
            selection, thresholds = select_threshold(val_truth, scores, labels)
            score = selection['metrics']['macro_f1_all_labels_zero_division_0']
            history.append({'epoch': epoch, 'train_bce': total_loss / len(train), 'validation_macro_f1': score})
            write(target / 'history.json', history)
            if score > best:
                best = score; stale = 0; best_epoch = epoch; chosen = selection; candidates = thresholds
                save_file({k: v.detach().cpu().contiguous() for k, v in model.state_dict().items()}, str(target / 'model.safetensors'))
            else:
                stale += 1
            if stale >= patience:
                break
    report = {'kind': kind, 'seed': seed, 'device': device, 'max_tokens': metadata['max_tokens'],
              'batch_size': batch_size, 'learning_rate': lr, 'precision': 'float32', 'best_epoch': best_epoch,
              'epochs_requested': epochs if kind != 'tfidf' else 1, 'epochs_run': len(history) if history else 1,
              'threshold': chosen['threshold'], 'validation': chosen['metrics'], 'threshold_candidates': candidates,
              'constants': constants, 'unlearnable_labels': [l for l, c in zip(labels, constants) if c is not None],
              'dataset_sha256': file_hash(Path(dataset) / 'READY.json'), 'dataset': metadata,
              'selection': 'validation macro across frozen target labels, micro, nearest threshold .5; first best epoch',
              'seconds': time.perf_counter() - started, 'torch': torch.__version__,
              'synthetic': metadata['synthetic'], 'test_used_for_selection': False,
              'task_limit': 'review-level fine-target presence; not trained opinion/evidence extraction; no Steam recommendation input',
              'classification_unit': 'leaf_id'}
    write(target / 'report.json', report)
    seal(target, {'kind': kind, 'dataset_sha256': report['dataset_sha256'], 'synthetic': metadata['synthetic']})
    return report


class Predictor:
    """Verify/load once per batch worker; no network or runtime base dependency."""
    def __init__(self, model_root, device='cpu'):
        from transformers import AutoTokenizer
        from .contract import POLICY, labels, taxonomy
        from .common import fingerprint
        self.root = Path(model_root); verify(self.root)
        self.report = read(self.root / 'report.json'); report = self.report
        if report.get('classification_unit') != 'leaf_id' or report['dataset'].get('contract') != 'review-training-v06':
            raise ValueError('LEGACY_COARSE_MODEL_REQUIRES_RETRAINING')
        tax = taxonomy(report['dataset']['taxonomy'])
        from .taxonomy import require_frozen_taxonomy
        require_frozen_taxonomy(tax, report['synthetic'])
        if (report['dataset']['labels'] != labels(tax)
                or report['dataset']['label_schema_sha256'] != fingerprint(labels(tax))
                or report['dataset'].get('label_to_id_sha256') != fingerprint({label: i for i, label in enumerate(labels(tax))})
                or report['dataset']['policy_sha256'] != fingerprint(POLICY)
                or report['dataset']['taxonomy_sha256'] != fingerprint(tax)):
            raise ValueError('MODEL_CONTRACT_CHANGED')
        self.tokenizer = AutoTokenizer.from_pretrained(self.root / 'tokenizer', local_files_only=True, trust_remote_code=False)
        self.device = device
        if report['kind'] == 'tfidf':
            self.baseline = tfidf_bundle(self.root)
        else:
            from safetensors.torch import load_file
            self.model = network(report['kind'], self.root / 'encoder_config', len(report['dataset']['labels']), pretrained=False)
            self.model.load_state_dict(load_file(str(self.root / 'model.safetensors'), device='cpu'), strict=True)
            self.model.to(device).eval()

    def score(self, texts):
        report = self.report
        if not texts or any(not isinstance(t, str) or not t.strip() for t in texts):
            raise ValueError('EMPTY_MODEL_INPUT')
        if any(len(self.tokenizer(text, truncation=False)['input_ids']) > report['max_tokens'] for text in texts):
            raise ValueError('LONG_BODY_HELD_NO_TRUNCATION')
        if report['kind'] == 'tfidf':
            scores = tfidf_scores(self.root, texts, self.baseline)
        else:
            scores = neural_scores(self.model, self.tokenizer, texts, report['max_tokens'], self.device, report['batch_size'])
        return checked(constant_scores(scores, report['constants']), len(texts), report['dataset']['labels'])


def predict(model_root, texts, device='cpu'):
    predictor = Predictor(model_root, device)
    return predictor.score(texts), predictor.report
