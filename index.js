const { Token } = require('@uniswap/sdk-core')
const {getRandomNumber, loadPrivateKeys} = require('./lib/function')
const RouterABI = require('./abis/uniswap-router.json')
const ERC20ABI = require('./abis/erc20.json')
const WETHABI = require('./abis/weth.json')

const {ethers, parseEther} = require('ethers')
require('dotenv').config()
const provider = new ethers.JsonRpcProvider("https://sepolia.unichain.org ")

const TESTTOKEN = new Token(130, "0x21973cE848CF74DE13d323945e325f5388E1a092", 18, "TEST", "testTOKEN")
const WETHTOKEN = new Token(130, "0x4200000000000000000000000000000000000006", 18, "WETH", "Wrapped ETH")
const ROUTER_ADDRESS = "0xd1AAE39293221B77B0C71fBD6dCb7Ea29Bb5B166"

const getFund = async (address) => {
  const wallet = new ethers.Wallet(process.env.PK, provider)
  const initialAmount = process.env.INITIAL_ETH_BALANCE || 0.0001
  const balanceETH = await provider.getBalance(wallet.address)
  console.log(`[getETH] balance primary wallet ${balanceETH/BigInt(1e18)} ETH`)

  if (balanceETH < BigInt((initialAmount * 1e18) * 2)) {
    return console.log(`[getETH] 🚨 minimum balance in primary wallet is ${parseFloat(initialAmount * 2).toFixed(5)} ETH`)
  }

  const txTransfer = await wallet.sendTransaction({
    to: address,
    value: parseEther(initialAmount)
  }).catch((e) => ({status: 500, message: e.shortMessage}))

  if (txTransfer.status != 500) {
    console.log(`[getETH][tx] ⌛ transfer ${initialAmount} ETH to bot wallet transaction with hash ${txTransfer.hash}`)
    try {
      await txTransfer.wait()
      console.log(`[getETH] ✅ confirmed ${txTransfer.hash}`)
    } catch (e) {
      console.error(`[getETH] failed ${e.message}`)
    }
  } else {
    console.log(`[getETH] 🚨 token transfer error ${txTransfer.message}`)
  }
}

const swapToken = async (pk) => {
  const wallet = new ethers.Wallet(pk, provider)
  const routerContract = new ethers.Contract(ROUTER_ADDRESS, RouterABI, wallet)
  console.log(`[pool] router loaded`)
  const amountSwap = getRandomNumber()
  console.log(`[swapToken] swap ${amountSwap} ETH to testTOKEN`)

  const txSwap = await routerContract.exactInputSingle({
    tokenIn: WETHTOKEN.address,
    tokenOut: TESTTOKEN.address,
    fee: 10000,
    recipient: wallet.address,
    amountIn: ethers.parseEther(amountSwap.toString()),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }, {value: ethers.parseEther(amountSwap.toString())}).catch((e) => ({status: 500, message: e.shortMessage}))

  if (txSwap.status != 500) {
    console.log(`[swapToken][tx] ⌛ submited swap transaction with hash ${txSwap.hash}`)
    try {
      await txSwap.wait()
      console.log(`[swapToken][tx] ✅ swap confirmed ${txSwap.hash}`)
    } catch (e) {
      console.log(`[swapToken][tx] 🚨 swap failed ${txSwap.message}`)
    }
  } else {
    console.log(`[swapToken][tx] 🚨 swap error ${txSwap.message}`)
  }
}

const swapETH = async (pk) => {
  const wallet = new ethers.Wallet(pk, provider)
  const routerContract = new ethers.Contract(ROUTER_ADDRESS, RouterABI, wallet)
  const tokenContract = new ethers.Contract(TESTTOKEN.address, ERC20ABI, wallet)
  const wethContract = new ethers.Contract(WETHTOKEN.address, WETHABI, wallet)
  
  console.log(`[pool] router loaded`)
  console.log(`[token] testToken contract loaded`)

  const balance = await tokenContract.balanceOf(wallet.address)
  console.log(`[token] balance ${wallet.address}`, parseFloat(balance/BigInt(1e18)).toFixed(2), 'TOKEN')

  const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS)
  const amountSwap = balance / BigInt(2)
  if (amountSwap < 1) {
    return console.log(`[token][swap] 🚨 minimum swap 1 testTOKEN`)
  }

  if (allowance < amountSwap) {
    console.log(`[token][approve] Approve Token to Router`)
    const txApprove = await tokenContract.approve(ROUTER_ADDRESS, amountSwap).catch((e) => ({status: 500, message: e.shortMessage}))
    if (txApprove.status != 500 ) {
      console.log(`[token][approve] approve ${amountSwap/BigInt(1e18)} to spender ${ROUTER_ADDRESS}`)
      console.log(`[token][tx] ⌛ approve transaction with hash ${txApprove.hash}`)
      try {
        await txApprove.wait()
        console.log(`[token][tx] ✅ approve confirmed ${txApprove.hash}`)

        // UNWRAP WETH TO ETH
        const balanceWETH = await wethContract.balanceOf(wallet.address)
        if (balanceWETH > 0) {
          console.log(`[weth] withdraw to ETH ${parseFloat(balanceWETH/BigInt(1e18)).toFixed(8)} wETH`)
          const txUnwrap = await wethContract.withdraw(balanceWETH).catch((e) => ({status: 500, message: e.shortMessage}))
          console.log(`[weth] ⌛ withdraw transaction with hash ${txApprove.hash}`)
          if (txUnwrap.status != 500) {
            try {
              await txUnwrap.wait()
              console.log(`[weth] ✅ withdraw confirmed ${txUnwrap.hash}`)
            } catch (e) {
              console.log(`[weth] 🚨 withdraw confirmation failed ${e.message}`)              
            }
          }
        }
      } catch (e) {
        console.log(`[token][tx] 🚨 approve confirmation failed ${e.message}`)
      }
    } else {
      console.log(`[token][tx] 🚨 approve error ${txApprove.message}`)
    }
  }

  const txSwap = await routerContract.exactInputSingle({
    tokenIn: TESTTOKEN.address,
    tokenOut: WETHTOKEN.address,
    fee: 10000,
    recipient: wallet.address,
    amountIn: amountSwap,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }).catch((e) => ({status: 500, message: e.shortMessage}))

  if (txSwap.status != 500) {
    console.log(`[swapToken][tx] ⌛ submited swap transaction with hash ${txSwap.hash}`)
    try {
      await txSwap.wait()
      console.log(`[swapToken][tx] ✅ swap confirmed ${txSwap.hash}`)
    } catch (e) {
      console.error(e)
    }
  } else {
    console.log(`[swapToken][tx] 🚨 swap error ${txSwap.message}`)
  }
}

const tokenTransfer = async (pk) => {
  const wallet = new ethers.Wallet(pk, provider)
  const tokenContract = new ethers.Contract(TESTTOKEN.address, ERC20ABI, wallet)
  const balanceToken = await tokenContract.balanceOf(wallet.address)
  console.log(`[tokenTransfer] balance ${balanceToken/BigInt(1e18)} testTOKEN`)
  const amountTransfer = balanceToken/BigInt(2)
  const txTransfer = await tokenContract.transfer(wallet.address, amountTransfer).catch((e) => ({status: 500, message: e.shortMessage}))
  if (txTransfer.status != 500) {
    console.log(`[tokenTransfer][tx] ⌛ transfer token to my self transaction with hash ${txTransfer.hash}`)
    try {
      await txTransfer.wait()
      console.log(`[tokenTransfer] ✅ confirmed ${txTransfer.hash}`)
    } catch (e) {
      console.error(`[tokenTransfer] failed ${e.message}`)
    }
  } else {
    console.log(`[tokenTransfer] 🚨 token transfer error ${txTransfer.message}`)
  }
}

const acts = [
  tokenTransfer,
  swapETH,
  swapToken
]

const main = async () => {
  const privateKeys = loadPrivateKeys('./private_keys.txt'); // Ubah sesuai dengan path file .txt Anda

  for (const privateKey of privateKeys) {
    // Pilih fungsi acak dari acts
    const wallet = new ethers.Wallet(privateKey, provider)
    console.log(`[wallet] address ${wallet.address}`)
    const balanceETH = await provider.getBalance(wallet.address)
    const minimumETHBalance = process.env.MINIMUM_ETH_BALANCE || 0.0005

    if (balanceETH < BigInt(minimumETHBalance * 1e18)) {
      await getFund(wallet.address)
    }

    const randomFunction = acts[Math.floor(Math.random() * acts.length)];
    await randomFunction(privateKey);
  }

  return main()
}

main()