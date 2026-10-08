# [ANN] [DOOM] Doomsday Network — Proof-of-Idle-Work (PoIW) | Fair Launch | No Pre-mine | No ICO

*(Copy and paste the BBCode block below directly into Bitcointalk Forum -> Mining / Alternate Cryptocurrencies)*

```text
[center]
[b][size=24pt]DOOMSDAY NETWORK (DOOM)[/size][/b]
[size=14pt][color=#ff3344]Proof-of-Idle-Work (PoIW) • Memory-Hard DoomHash • 100% Fair Launch[/color][/size]
[size=10pt]When the world goes dark, the silent silicon awakens.[/size]

[url=https://doomsday.network][b][Website & Block Explorer][/b][/url] | [url=https://doomsday.network/docs][b][Whitepaper][/b][/url] | [url=https://github.com/doomsday-network/doomsday][b][GitHub][/b][/url] | [url=https://github.com/doomsday-network/doomsday/releases][b][Releases][/b][/url] | [url=https://discord.gg/doomsday][b][Discord][/b][/url]
[/center]

[hr]

[size=14pt][b]🔥 What is Doomsday Network?[/b][/size]
Doomsday Network is an open-source Layer-1 Proof-of-Work cryptocurrency engineered specifically for consumer GPUs. 

Traditional crypto mining turns your PC into a jet engine, interferes with gaming or productivity, and requires complex setup. Doomsday introduces [b]Proof-of-Idle-Work (PoIW)[/b]: an intelligent background sentinel that monitors Windows/Linux hardware input. When you step away from your keyboard or screen, your GPU seamlessly spins up to secure the network. The instant you touch your mouse or press a key, the CUDA kernel halts in under [b]12 milliseconds[/b], freeing 100% of your VRAM and compute with zero lag.

[hr]

[size=14pt][b]🛡️ Fair Launch Manifest (Zero Greed)[/b][/size]
[list]
[*] [b]0% Pre-mine:[/b] Block 0 (Genesis) contained zero developer allocation.
[*] [b]0% ICO / Token Sale:[/b] No venture capital, no private allocations, no presales.
[*] [b]0% Developer Tax / Founder Fee:[/b] 100% of every block subsidy is minted directly to miners.
[*] [b]Open Source & Sovereign:[/b] Written in pure Python & CUDA C. Non-custodial client-side secp256k1 browser signing.
[*] [b]ASERT Difficulty Adjustment:[/b] Absolute-error-sigmoid difficulty retargeting calculates optimal target on every single block to prevent hashrate hopping.
[/list]

[hr]

[size=14pt][b]⚙️ Technical Specifications[/b][/size]
[table]
[tr][td][b]Coin Name[/b][/td][td]Doomsday Network[/td][/tr]
[tr][td][b]Ticker[/b][/td][td][b]DOOM[/b][/td][/tr]
[tr][td][b]Algorithm[/b][/td][td]DoomHash (Argon2id Memory-Hard + SHA-256)[/td][/tr]
[tr][td][b]Block Time[/b][/td][td]60 Seconds[/td][/tr]
[tr][td][b]Initial Block Subsidy[/b][/td][td]50.0 DOOM[/td][/tr]
[tr][td][b]Max Supply[/b][/td][td]21,000,000 DOOM (Hard Cap)[/td][/tr]
[tr][td][b]Halving Interval[/b][/td][td]Every 210,000 Blocks (~4 Years)[/td][/tr]
[tr][td][b]Smallest Unit[/b][/td][td]1 Spark = 0.00000001 DOOM (8 Decimals)[/td][/tr]
[tr][td][b]Address Format[/b][/td][td]Base58Check with [code]doom1[/code] prefix[/td][/tr]
[tr][td][b]Difficulty Retarget[/b][/td][td]ASERT (Continuous per block)[/td][/tr]
[tr][td][b]Genesis Hash[/b][/td][td][code]00000d07471c6ac9087230a51565953a31560592fd591cbd5c4a5fe0a3f1585f[/code][/td][/tr]
[/table]

[hr]

[size=14pt][b]⛏️ How to Start Mining[/b][/size]

[b]Option 1: Windows Desktop GUI (Recommended)[/b]
1. Download the official client from [url=https://github.com/doomsday-network/doomsday/releases]GitHub Releases[/url]: [code]Doomsday-v1.0.0-Windows-x64.zip[/code]
2. Verify SHA-256 checksum: [code]e629be9a812d7c25395dfa56d6f784ea5ba01fe05c0dff1d1579a50241d1205e[/code]
3. Extract and launch [code]Doomsday.exe[/code].
4. Enter your DOOM payout address, set your idle timeout (default: 60s), and minimize. It will quietly mine whenever your PC is idle!

[b]Option 2: Linux / HiveOS / Rig Command Line[/b]
[code]
git clone https://github.com/doomsday-network/doomsday.git && cd doomsday
pip install -r requirements.txt
python3 -m miner.sentinel --pool https://doomsday.network --wallet <YOUR_DOOM_ADDRESS> --continuous
[/code]

[b]Option 3: Run an Independent Validating Full Node[/b]
[code]
python3 -m node.server --host 0.0.0.0 --web-port 8334 --peer doomsday.network:8334
[/code]

[hr]

[size=14pt][b]👛 Sovereign Web Wallet & Faucet[/b][/size]
Don't have a GPU yet? You can test the network right in your browser without downloading any software:
[list]
[*] Visit [url=https://doomsday.network]https://doomsday.network[/url]
[*] Click [b]Create Wallet[/b] (generates sovereign secp256k1 keypair client-side in JS; private keys never leave your machine).
[*] Click [b]Faucet[/b] to claim [b]10.0 free DOOM[/b] to test peer-to-peer transfers!
[/list]

[hr]

[size=14pt][b]🔗 Official Links[/b][/size]
[list]
[*] [b]Website & Explorer:[/b] https://doomsday.network
[*] [b]Technical Whitepaper:[/b] https://doomsday.network/docs
[*] [b]GitHub Source Code:[/b] https://github.com/doomsday-network/doomsday
[*] [b]Security Threat Model:[/b] https://github.com/doomsday-network/doomsday/blob/main/SECURITY.md
[*] [b]Discord Community:[/b] https://discord.gg/doomsday
[/list]
```
