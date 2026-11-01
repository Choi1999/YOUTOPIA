import tempfile
from pathlib import Path
import unittest
from redis_contract import deployment_image, image_from_compose, image_version

class RedisImageContract(unittest.TestCase):
    def test_deployment_version_is_patched_and_digest_pinned(self):
        image=deployment_image()
        self.assertEqual(image_version(image),'7.2.17')
        self.assertIn('7.2.17-bookworm@sha256:',image)
        self.assertTrue(image.endswith('0312984fbfeb2ff1d4382ecef45b50e7d65478a6a58cf12ce28d6de7a4142e45'))

    def test_unpinned_floating_or_multiple_images_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'compose.yaml'
            for value in ('image: redis:latest','  image: public.ecr.aws/docker/library/redis:7.2.17-bookworm',
                          '  image: public.ecr.aws/docker/library/redis:7.2-bookworm@sha256:'+'a'*64,
                          '  image: '+deployment_image()+'\n  image: '+deployment_image()):
                path.write_text(value+'\n')
                with self.subTest(value=value),self.assertRaises(ValueError):image_from_compose(path)

if __name__=='__main__':unittest.main()
