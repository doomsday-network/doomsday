import argparse
import json
import os
import requests
from core.crypto import generate_keypair, private_key_to_wif, public_key_to_address


def generate_wallet(filepath: str = "wallet.json"):
    priv, pub = generate_keypair()
    wif = private_key_to_wif(priv)
    addr = public_key_to_address(pub)

    data = {
        "address": addr,
        "private_key": wif
    }

    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

    print("\n=======================================================")
    print("[+] NEW DOOMSDAY WALLET GENERATED")
    print(f"Address:     {addr}")
    print(f"Saved to:    {filepath}")
    print("=======================================================\n")
    return data


def check_balance(address: str, node_url: str = "http://localhost:8334"):
    try:
        resp = requests.get(f"{node_url.rstrip('/')}/wallet/{address}", timeout=3)
        if resp.status_code == 200:
            data = resp.json()
            print(f"\nAddress: {data['address']}")
            print(f"Balance: {data['balance_doom']:,.2f} DOOM ({data['balance_sparks']:,} Sparks)\n")
        else:
            print("Failed to fetch balance:", resp.text)
    except Exception as e:
        print("Error connecting to node:", e)


def send_coins(to_address: str, amount: float, wallet_file: str = "wallet.json", node_url: str = "http://localhost:8334"):
    if not os.path.exists(wallet_file):
        print(f"Wallet file not found: {wallet_file}")
        return

    with open(wallet_file) as f:
        wallet = json.load(f)

    from core.crypto import private_key_from_wif, public_key_to_address
    from core.transaction import Transaction, TxInput, TxOutput, COIN

    priv = private_key_from_wif(wallet["private_key"])
    derived_addr = public_key_to_address(priv.public_key())
    if derived_addr != wallet["address"]:
        print("Error: Private key in wallet file does not match wallet address.")
        return

    # Fetch UTXOs from node
    try:
        resp = requests.get(f"{node_url.rstrip('/')}/wallet/{wallet['address']}/utxos", timeout=5)
        if resp.status_code != 200:
            print("Failed to fetch UTXOs from node:", resp.text)
            return
        utxo_data = resp.json()
    except Exception as e:
        print("Error connecting to node:", e)
        return

    amount_sparks = int(round(amount * COIN))
    fee_sparks = int(0.001 * COIN)
    total_required = amount_sparks + fee_sparks

    utxos = utxo_data.get("utxos", [])
    inputs = []
    accum = 0
    for u in utxos:
        inputs.append(TxInput(txid=u["txid"], vout=u["vout"]))
        accum += u["amount"]
        if accum >= total_required:
            break

    if accum < total_required:
        print(f"Insufficient funds: Available {accum/COIN:.4f} DOOM, needed {total_required/COIN:.4f} DOOM (including {fee_sparks/COIN:.4f} fee)")
        return

    outputs = [TxOutput(recipient=to_address, amount=amount_sparks)]
    change = accum - total_required
    if change > 0:
        outputs.append(TxOutput(recipient=wallet["address"], amount=change))

    # Construct and sign transaction locally
    tx = Transaction(inputs=inputs, outputs=outputs)
    for idx in range(len(inputs)):
        tx.sign_input(idx, priv)

    # Broadcast signed transaction to network
    try:
        resp = requests.post(
            f"{node_url.rstrip('/')}/tx/broadcast",
            json={"transaction": tx.to_dict()},
            timeout=5
        )
        if resp.status_code == 200:
            res = resp.json()
            print(f"\n[+] Transaction signed locally & broadcast successfully!")
            print(f"TxID:        {res['txid']}")
            print(f"Inputs:      {res['inputs']}")
            print(f"Outputs:     {res['outputs']}")
            print(f"Fee:         {fee_sparks/COIN} DOOM\n")
        else:
            print(f"Transaction rejected: {resp.text}")
    except Exception as e:
        print("Error broadcasting transaction:", e)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Doomsday Network Wallet CLI")
    subparsers = parser.add_subparsers(dest="command")

    gen_parser = subparsers.add_parser("generate", help="Generate a new wallet")
    gen_parser.add_argument("--file", default="wallet.json", help="Output file path")

    bal_parser = subparsers.add_parser("balance", help="Check wallet balance")
    bal_parser.add_argument("--address", required=True, help="Wallet address")
    bal_parser.add_argument("--node", default="http://localhost:8334", help="Node URL")

    send_parser = subparsers.add_parser("send", help="Send DOOM coins")
    send_parser.add_argument("--to", required=True, help="Recipient address")
    send_parser.add_argument("--amount", type=float, required=True, help="Amount in DOOM")
    send_parser.add_argument("--wallet", default="wallet.json", help="Wallet JSON file")
    send_parser.add_argument("--node", default="http://localhost:8334", help="Node URL")

    args = parser.parse_args()
    if args.command == "generate":
        generate_wallet(args.file)
    elif args.command == "balance":
        check_balance(args.address, args.node)
    elif args.command == "send":
        send_coins(args.to, args.amount, args.wallet, args.node)
    else:
        parser.print_help()
