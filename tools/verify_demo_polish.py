#!/usr/bin/env python3
"""시연 UI의 프로덕션 정적 빌드를 모킹 API로 검증한다. DB·실제 제공자는 사용하지 않는다."""
import hashlib,json,os,re,subprocess
from pathlib import Path
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
env={k:v for k,v in os.environ.items() if not k.startswith(('DB_','PG','YOUTOPIA_','OPENAI_')) and not re.search('PASSWORD|SECRET|TOKEN|PRIVATE_KEY|API_KEY',k,re.I)}
subprocess.run(['pnpm','build'],cwd=root/'frontend',env=env,check=True)
subprocess.run(['pnpm','exec','playwright','test','--config','playwright.polish.config.ts'],cwd=root/'frontend',env=env,check=True)
report=json.loads((root/'frontend/test-results/demo-polish/results.json').read_text())
stats=report['stats']
if stats['expected']!=4 or any(stats[k] for k in ('unexpected','flaky','skipped')) or report.get('errors'):raise SystemExit('시연 UI 브라우저 검증 실패')
contract=ET.parse(root/'build/test-results/test/TEST-com.youtopia.account.AuthenticationIdentityTest.xml').getroot()
if int(contract.get('tests','0'))<1 or any(int(contract.get(k,'0')) for k in ('failures','errors','skipped')):raise SystemExit('기존 인증 응답 계약 검증 실패')
jar=root/'build/libs/youtopia-backend-0.1.0-SNAPSHOT.jar'
dirty=bool(subprocess.check_output(['git','status','--porcelain'],cwd=root).strip())
result={'status':'PASS','browser_ui_verified':True,'jar_sha256':hashlib.sha256(jar.read_bytes()).hexdigest(),
 'source_sha':None if dirty else subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'verification_profile':'시연 UI 최소 검증: 프로덕션 정적 빌드·모킹 API·기존 인증 응답 계약',
 'browser_cases':4,'authentication_response_contract_tests':int(contract.get('tests')),
 'packaged_jar_started':False,'production_runtime_verified':False,'real_authentication_tested':False,
 'full_backend_or_security_regression_repeated':False,'actual_provider_calls':0,'DB_or_Redis_used':False}
dest=root/'build/reports/demo-polish';dest.mkdir(parents=True,exist_ok=True)
(dest/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
# 배포 게이트에 현재 범위와 바이너리 바이트를 명시한다. 실제 세션/DB 검증으로 확대하지 않는다.
gate=root/'build/reports/packaged-sessions';gate.mkdir(parents=True,exist_ok=True)
(gate/'result-browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
