import "react-native-get-random-values";
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import * as Linking from "expo-linking";
import nacl from "tweetnacl";
import bs58 from "bs58";

const onConnectRedirectLink = Linking.createURL("onConnect");

export default function App() {
  const [dappKeyPair] = useState(nacl.box.keyPair());

  const connect = async () => {
    const baseUrl = "https://phantom.app/ul/v1/";
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      cluster: "mainnet-beta",
      app_url: "https://phantom.app",
      redirect_link: onConnectRedirectLink,
    });

    const myUrl = `${baseUrl}connect?${params.toString()}`;
    
    Linking.openURL(myUrl);
  };

  return (
    <View style={styles.container}>
      <Text>Crunchy vs Smooth</Text>
      <Button title="Connect" onPress={connect} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
