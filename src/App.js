import {useEffect, useState} from 'react';
import twitterLogo from './assets/twitter-logo.svg';
import './App.css';
import {clusterApiUrl, Connection, PublicKey} from '@solana/web3.js';
import {Program, Provider, web3} from '@project-serum/anchor';

import idl from './idl.json';
import kp from './keypair.json'

/*
const TEST_GIFS = [
  'https://media.giphy.com/media/BMWqzx9r6CPeBAAifT/giphy-downsized-large.gif',
  'https://media.giphy.com/media/8dxRUHVe7UULe/giphy.gif',
  'https://media.giphy.com/media/1dkVkTu5wreGk/giphy.gif',
  'https://media.giphy.com/media/PinQmyLYvrGVO/giphy.gif',
  'https://media.giphy.com/media/lCgprooLDVVKM/giphy-downsized-large.gif',
]
 */

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram, Keypair } = web3;

// Get the keypair for the account that will hold the GIF data.
const baseAccount = Keypair.fromSecretKey(new Uint8Array(Object.values(kp._keypair.secretKey)))

// Get our program's id form the IDL file.
const programID = new PublicKey(idl.metadata.address);

// Set our network to devent.
const network = clusterApiUrl('devnet');

// Control's how we want to acknowledge when a trasnaction is "done".
const opts = {
  preflightCommitment: "processed"
}

// Constants
const TWITTER_HANDLE = '_buildspace';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

const App = () => {
  // State
  const [walletAddress, setWalletAddress] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [gifList, setGifList] = useState([]);

  // Actions
  const checkIfWalletIsConnected = async () => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          console.log('Phantom wallet found!');
          const response = await solana.connect({ onlyIfTrusted: true });
          console.log(
              'Connected with Public Key:',
              response.publicKey.toString()
          );

          /*
           * Set the user's publicKey in state to be used later!
           */
          setWalletAddress(response.publicKey.toString());
        }
      } else {
        alert('Solana object not found! Get a Phantom Wallet 👻');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const connectWallet = async () => {
    const { solana } = window;

    if (solana) {
      const response = await solana.connect();
      console.log('Connected with Public Key:', response.publicKey.toString());
      setWalletAddress(response.publicKey.toString());
    }
  };

  const upvoteGif = async ({gifLink}) => {
    console.log('Upvoting GIF:', gifLink);
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.upvoteGif(gifLink, {
        accounts: {
          baseAccount: baseAccount.publicKey
        },
      });
      console.log("GIF successfully updated", gifLink)

      await getGifList();
    } catch (error) {
      console.log("Error upvoting GIF:", error)
    }
  };

  const onInputChange = (event) => {
    const { value } = event.target;
    setInputValue(value);
  };

  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    return new Provider(
        connection, window.solana, opts.preflightCommitment,
    );
  }

  const createGifAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log("ping")
      await program.rpc.startStuffOff({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount]
      });
      console.log("Created a new BaseAccount w/ address:", baseAccount.publicKey.toString())
      await getGifList();

    } catch(error) {
      console.log("Error creating BaseAccount account:", error)
    }
  }

  const getGifList = async() => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);

      console.log("Got the account", account)
      setGifList(account.gifList)

    } catch (error) {
      console.log("Error in getGifs: ", error)
      setGifList(null);
    }
  }

  useEffect(() => {
    if (walletAddress) {
      console.log('Fetching GIF list...');
      getGifList()
    }
  }, [walletAddress]);

  const sendGif = async () => {
    if (inputValue.length === 0) {
      console.log("No gif link given!")
      return
    }
    console.log('Gif link:', inputValue);
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.addGif(inputValue, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("GIF successfully sent to program", inputValue)

      await getGifList();
    } catch (error) {
      console.log("Error sending GIF:", error)
    }
  };

  const renderNotConnectedContainer = () => (
      <button
          className="cta-button connect-wallet-button"
          onClick={connectWallet}
      >
        Connect to Wallet
      </button>
  );

  const renderConnectedContainer = () => {
    // If we hit this, it means the program account hasn't be initialized.
    if (gifList === null) {
      return (
          <div className="connected-container">
            <button className="cta-button submit-gif-button" onClick={createGifAccount}>
              Do One-Time Initialization For GIF Program Account
            </button>
          </div>
      )
    }
    // Otherwise, we're good! Account exists. User can submit GIFs.
    else {
      return(
          <div className="connected-container">
            <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendGif();
                }}
            >
              <input
                  type="text"
                  placeholder="Enter gif link!"
                  value={inputValue}
                  onChange={onInputChange}
              />
              <button type="submit" className="cta-button submit-gif-button">
                Submit
              </button>
            </form>
            <div className="gif-grid">
              {/* We use index as the key instead, also, the src is now item.gifLink */}
              {gifList.map((item, index) => {
                const userAddress = item.userAddress?.toString();
                return (
                  <div className="gif-item" key={index}>
                    <img src={item.gifLink} alt={`Gif submitted by ${userAddress}`}/>
                    <div className="details">
                      Total Votes: {item.totalVotes.toString()}<br/>
                      User: <span className="submitted-by">{userAddress}</span>
                      <button
                          className="cta-button vote"
                          onClick={() => upvoteGif({gifLink:item.gifLink})}
                      >
                        Vote
                      </button>
                    </div>
                  </div>
              )})}
            </div>
          </div>
      )
    }
  }

  // UseEffects
  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return (
      <div className="App">
        {/* This was solely added for some styling fanciness */}
        <div className={walletAddress ? 'authed-container' : 'container'}>
          <div className="header-container">
            <p className="header">🖼 Shrek is Love, Shrek is Life</p>
            <p className="sub-text">
              A collection of shrek gifs in solana ✨
            </p>
            {!walletAddress && renderNotConnectedContainer()}
            {walletAddress && renderConnectedContainer()}
          </div>
          <div className="footer-container">
            <img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
            <a
                className="footer-text"
                href={TWITTER_LINK}
                target="_blank"
                rel="noreferrer"
            >{`built using projects (not courses) from @${TWITTER_HANDLE}`}</a>
          </div>
        </div>
      </div>
  );
};

export default App;