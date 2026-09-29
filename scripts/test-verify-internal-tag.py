import os
import pathlib
import subprocess
import tempfile
import unittest


SCRIPT = pathlib.Path(__file__).with_name("verify-internal-tag.sh")


class InternalTagVerificationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = pathlib.Path(self.temp.name)
        self.repo = root / "repo"
        self.repo.mkdir()
        self.remote = root / "origin.git"
        self.output = root / "output"
        self.bin = root / "bin"
        self.bin.mkdir()
        mock = self.bin / "gh"
        mock.write_text(
            '#!/bin/sh\n'
            'case "$2" in\n'
            '  "repos/example/pix/actions/workflows/ci.yml/runs?"*)\n'
            '    echo "${MOCK_CI_RESULT:-1}" ;;\n'
            '  *) echo "unexpected CI request" >&2; exit 1 ;;\n'
            "esac\n"
        )
        mock.chmod(0o700)
        subprocess.run(["git", "init", "-q", "-b", "main", str(self.repo)], check=True)
        self.git("config", "user.name", "Release Test")
        self.git("config", "user.email", "release@example.invalid")
        (self.repo / "README").write_text("tested")
        self.git("add", "README")
        self.git("commit", "-qm", "tested")
        subprocess.run(["git", "clone", "-q", "--bare", str(self.repo), str(self.remote)], check=True)
        self.git("remote", "add", "origin", str(self.remote))

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], text=True).strip()

    def verify(self, tag, ci="1"):
        env = dict(
            os.environ,
            GITHUB_REF=f"refs/tags/{tag}",
            GITHUB_OUTPUT=str(self.output),
            GITHUB_REPOSITORY="example/pix",
            MOCK_CI_RESULT=ci,
            PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
        )
        return subprocess.run(["bash", str(SCRIPT)], cwd=self.repo, env=env, capture_output=True, text=True)

    def test_valid_annotated_tag_on_tested_main(self):
        self.git("tag", "-am", "candidate", "v1.2.3-rc.4")
        self.git("push", "-q", "origin", "v1.2.3-rc.4")
        result = self.verify("v1.2.3-rc.4")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("version=1.2.3\n", self.output.read_text())
        self.assertIn("tag=v1.2.3-rc.4\n", self.output.read_text())

    def test_valid_lightweight_tag_on_tested_main(self):
        self.git("tag", "v1.2.3-rc.4")
        self.git("push", "-q", "origin", "v1.2.3-rc.4")
        self.assertEqual(self.verify("v1.2.3-rc.4").returncode, 0)

    def test_rejects_bad_tag_name(self):
        for tag in ("v1.2.3", "v1.2.3-rc.0", "v01.2.3-rc.1", "v1.2.3-rc.1-extra"):
            with self.subTest(tag=tag):
                self.assertNotEqual(self.verify(tag).returncode, 0)

    def test_rejects_missing_main_ci(self):
        self.git("tag", "v1.2.3-rc.4")
        self.git("push", "-q", "origin", "v1.2.3-rc.4")
        self.assertNotEqual(self.verify("v1.2.3-rc.4", ci="0").returncode, 0)

    def test_rejects_tag_off_main(self):
        self.git("switch", "-qc", "feature")
        (self.repo / "README").write_text("not merged")
        self.git("commit", "-qam", "unreviewed")
        self.git("tag", "v1.2.3-rc.4")
        self.git("push", "-q", "origin", "v1.2.3-rc.4")
        self.assertNotEqual(self.verify("v1.2.3-rc.4").returncode, 0)

    def test_rejects_checkout_different_from_tag_target(self):
        self.git("tag", "v1.2.3-rc.4")
        self.git("push", "-q", "origin", "v1.2.3-rc.4")
        (self.repo / "README").write_text("different checkout")
        self.git("commit", "-qam", "different checkout")
        self.git("push", "-q", "origin", "main")
        self.assertNotEqual(self.verify("v1.2.3-rc.4").returncode, 0)


if __name__ == "__main__":
    unittest.main()
