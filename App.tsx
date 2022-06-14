import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import * as Linking from "expo-linking";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl.json";

const programID = new PublicKey(idl.metadata.address);

const onConnectRedirectLink = Linking.createURL("onConnect");
const onDisconnectRedirectLink = Linking.createURL("onDisconnect");

const decryptPayload = (
  data: string,
  nonce: string,
  sharedSecret?: Uint8Array
) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const decryptedData = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  if (!decryptedData) {
    throw new Error("Unable to decrypt data");
  }
  return JSON.parse(Buffer.from(decryptedData).toString("utf8"));
};

const encryptPayload = (payload: any, sharedSecret?: Uint8Array) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const nonce = nacl.randomBytes(24);

  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret
  );

  return [nonce, encryptedPayload];
};

export default function App() {
  const [deeplink, setDeepLink] = useState<string>("");
  const [dappKeyPair] = useState(nacl.box.keyPair());

  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [session, setSession] = useState<string>();
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] =
    useState<PublicKey | null>(null);

  const [voteAccount, setVoteAccount] = useState<{
    account: PublicKey | null;
    accountBump: Number | null;
  }>({
    account: null,
    accountBump: null,
  });

  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    };
    initializeDeeplinks();
    const listener = Linking.addEventListener("url", handleDeepLink);
    return () => {
      listener.remove();
    };
  }, []);

  const handleDeepLink = ({ url }: Linking.EventType) => setDeepLink(url);

  // handle in-bound links
  useEffect(() => {
    if (!deeplink) return;

    const url = new URL(deeplink);
    const params = url.searchParams;

    if (params.get("errorCode")) {
      console.log("error!");
      console.log(JSON.stringify(Object.fromEntries([...params]), null, 2));
      return;
    }

    if (/onConnect/.test(url.pathname)) {
      const sharedSecretDapp = nacl.box.before(
        bs58.decode(params.get("phantom_encryption_public_key")!),
        dappKeyPair.secretKey
      );

      const connectData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecretDapp
      );

      setSharedSecret(sharedSecretDapp);
      setSession(connectData.session);
      setPhantomWalletPublicKey(new PublicKey(connectData.public_key));
    } else if (/onDisconnect/.test(url.pathname)) {
      setPhantomWalletPublicKey(null);
    }
  }, [deeplink]);

  useEffect(() => {
    const getVoteAccount = async () => {
      let [account, accountBump] = await PublicKey.findProgramAddress(
        [Buffer.from("vote_account")],
        programID
      );
      setVoteAccount({ account, accountBump });
    };
    getVoteAccount();
  }, []);

  const connect = async () => {
    const baseUrl = "https://phantom.app/ul/v1/";
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      cluster: "mainnet-beta",
      app_url: "https://pbvote.com/",
      redirect_link: onConnectRedirectLink,
    });

    const url = `${baseUrl}connect?${params.toString()}`;

    Linking.openURL(url);
  };

  const disconnect = async () => {
    const payload = {
      session,
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const baseUrl = "https://phantom.app/ul/v1/";

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onDisconnectRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });

    const url = `${baseUrl}disconnect?${params.toString()}`;

    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Text>Crunchy vs Smooth</Text>
      {phantomWalletPublicKey ? (
        <>
          <Text>{`Connected with ${phantomWalletPublicKey}`}</Text>
          <Text>{`Account ${voteAccount.account}`}</Text>
          <Text>{`Account Bump ${voteAccount.accountBump}`}</Text>
          <Button title="Disconnect" onPress={disconnect} />
        </>
      ) : (
        <Button title="Connect" onPress={connect} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
