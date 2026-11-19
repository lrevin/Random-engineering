r"""강의실 PC → EC2 역방향 SSH 터널 (끊기면 자동으로 다시 연결).

준비:
  1. 김창원에게 받은 키 파일을 C:\ppobgong-llm\ 에 넣고 tunnel_config.json 의 key_file 에 파일 이름을 적습니다.
  2. tunnel_config.json 에 EC2 주소와 사용자 이름을 적습니다.
  3. server.py 를 다른 창에서 켜 둡니다.
실행 (C:\ppobgong-llm 에서):  python tunnel.py
  - 연결되면 EC2 안에서 http://127.0.0.1:18788 (remote_port) 로 실시간 서버를 쓸 수 있습니다.
  - 끄려면 Ctrl + C. 이 창도 테스트 기간 동안 켜 둡니다.
"""
import getpass
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "out", "log.txt")


def log(msg):
    line = time.strftime("%m-%d %H:%M:%S ") + "[터널] " + msg
    print(line, flush=True)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a", encoding="utf8") as f:
        f.write(line + "\n")


def fix_key_permission(key):
    """Windows SSH 는 키 파일을 다른 사용자도 읽을 수 있으면 거부함 → 내 계정만 읽게 바꿈"""
    if os.name != "nt":
        os.chmod(key, 0o600)
        return
    user = os.environ.get("USERNAME") or getpass.getuser()
    subprocess.run(["icacls", key, "/inheritance:r"], capture_output=True)
    subprocess.run(["icacls", key, "/grant:r", f"{user}:R"], capture_output=True)


def main():
    cfg = json.load(open(os.path.join(HERE, "tunnel_config.json"), encoding="utf8"))
    if any("<" in str(cfg[k]) for k in ("ec2_host", "ec2_user", "key_file")):
        sys.exit("tunnel_config.json 에 EC2 주소, 사용자 이름, 키 파일 이름을 먼저 적어 주세요.")
    key = os.path.join(HERE, cfg["key_file"])
    if not os.path.exists(key):
        sys.exit(f"키 파일이 없습니다: {key}")
    fix_key_permission(key)
    cmd = [
        "ssh", "-N", "-T",
        "-i", key,
        "-o", "ExitOnForwardFailure=yes",     # 터널을 못 열면 바로 끝내고 다시 시도
        "-o", "ServerAliveInterval=30",        # 30초마다 연결 확인
        "-o", "ServerAliveCountMax=3",         # 3번 응답 없으면 끊고 다시 연결
        "-o", "StrictHostKeyChecking=accept-new",
        "-R", f"127.0.0.1:{cfg['remote_port']}:127.0.0.1:{cfg['local_port']}",
        f"{cfg['ec2_user']}@{cfg['ec2_host']}",
    ]
    wait = 5
    while True:
        log(f"연결 시도: {cfg['ec2_user']}@{cfg['ec2_host']} (EC2 127.0.0.1:{cfg['remote_port']} → 이 PC 127.0.0.1:{cfg['local_port']})")
        start = time.time()
        code = subprocess.run(cmd).returncode
        alive = time.time() - start
        log(f"연결 끊김 (종료 코드 {code}, {alive:.0f}초 동안 연결됨)")
        wait = 5 if alive > 60 else min(wait * 2, 120)  # 바로 실패하면 점점 오래 기다림
        log(f"{wait}초 뒤 다시 연결")
        time.sleep(wait)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("사용자가 터널을 껐습니다")
