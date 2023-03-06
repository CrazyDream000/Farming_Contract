// import chai, { assert, expect } from "chai";
// import chaiAsPromised from "chai-as-promised";
// import { ethers, upgrades } from "hardhat";
// import { BigNumber } from "ethers";
// import { solidity } from "ethereum-waffle";

// import {
//   advanceTime,
//   daysToSeconds,
//   getNextTimestampDivisibleBy,
//   getTimestamp,
//   setTimestamp,
// } from "../../helpers/utils";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { FakeERC20, TokenBonding } from "../../typechain-types";
// import NetworkSnapshotter from "../../helpers/NetworkSnapshotter";

// const { AddressZero, MaxUint256 } = ethers.constants;

// chai.use(solidity);
// chai.use(chaiAsPromised);

// const week = daysToSeconds(BigNumber.from(7));
// const ten = BigNumber.from(10);
// const tenPow18 = ten.pow(18);

// describe("TokenBonding", () => {
//   let deployer: SignerWithAddress;
//   let signer1: SignerWithAddress;
//   let signer2: SignerWithAddress;
//   let signer3: SignerWithAddress;
//   let helio: FakeERC20;
//   let helioLp: FakeERC20;
//   let tokenBonding: TokenBonding;
//   let startTime: BigNumber;

//   let helioCoefficient: BigNumber;
//   let helioLpCoefficient: BigNumber;

//   const networkSnapshotter = new NetworkSnapshotter();

//   const setStartContractTimestamp = async () => {
//     // set right time
//     await setTimestamp(startTime.toNumber() + 1);
//   };

//   const getVeTokenByCoefficient = (amount: BigNumber, coefficient: BigNumber): BigNumber => {
//     return amount.mul(coefficient).div(tenPow18);
//   };

//   before("setup", async () => {
//     // setup
//     [deployer, signer1, signer2, signer3] = await ethers.getSigners();

//     const FakeToken = await ethers.getContractFactory("FakeERC20");
//     const TokenBonding = await ethers.getContractFactory("TokenBonding");

//     helio = await FakeToken.connect(deployer).deploy("Helio Token", "Helio");
//     await helio.deployed();
//     helioLp = await FakeToken.connect(deployer).deploy("Helio LP Token", "HelioLP");
//     await helioLp.deployed();

//     helioCoefficient = tenPow18.mul(1);
//     helioLpCoefficient = tenPow18.mul(2);

//     startTime = await getNextTimestampDivisibleBy(week.toNumber());

//     const tokens = [helio.address, helioLp.address];
//     const coefficients = [helioCoefficient, helioLpCoefficient];

//     tokenBonding = (await upgrades.deployProxy(TokenBonding, [
//       startTime,
//       tokens,
//       coefficients,
//     ])) as TokenBonding;
//     await tokenBonding.deployed();

//     // mint tokens
//     const amount = BigNumber.from("100000").mul(tenPow18);

//     await helio.mint(signer1.address, amount);
//     await helioLp.mint(signer1.address, amount);
//     await helio.mint(signer2.address, amount);
//     await helioLp.mint(signer2.address, amount);

//     await networkSnapshotter.firstSnapshot();
//   });

//   afterEach("revert", async () => await networkSnapshotter.revert());

//   describe("# constructor", () => {
//     it("startTime should be divisible to week", async () => {
//       const wrongStartTime = BigNumber.from(Math.floor(Date.now() / 1000) + 1000);
//       expect(wrongStartTime.div(week).mul(week)).to.not.be.equal(wrongStartTime);
//       const TokenBonding = await ethers.getContractFactory("TokenBonding");
//       await expect(
//         upgrades.deployProxy(TokenBonding, [wrongStartTime, [], []])
//       ).to.eventually.be.rejectedWith(Error, "!epoch week");
//     });

//     it("startTime should be more thant block timestamp", async () => {
//       const now = BigNumber.from(Math.floor(Date.now() / 1000));
//       const wrongStartTime = now.sub(1000);
//       assert.isTrue(wrongStartTime.lt(now));
//       const TokenBonding = await ethers.getContractFactory("TokenBonding");
//       await expect(
//         upgrades.deployProxy(TokenBonding, [wrongStartTime, [], []])
//       ).to.eventually.be.rejectedWith(Error, "!epoch week");
//     });

//     it("should revert if tokens length is not equal to coefficients length", async () => {
//       const tokens = [helio.address];
//       const coefficients = [helioCoefficient, helioLpCoefficient];
//       expect(tokens.length).to.be.not.equal(coefficients.length);
//       const TokenBonding = await ethers.getContractFactory("TokenBonding");
//       await expect(
//         upgrades.deployProxy(TokenBonding, [startTime, tokens, coefficients])
//       ).to.eventually.be.rejectedWith(Error, "Not equal lengths");
//     });

//     it("should emit events in construction", async () => {
//       const tokens = [helio.address, helioLp.address];
//       const coefficients = [helioCoefficient, helioLpCoefficient];
//       const TokenBonding = await ethers.getContractFactory("TokenBonding");

//       const tokenBonding = await upgrades.deployProxy(TokenBonding, [
//         startTime,
//         tokens,
//         coefficients,
//       ]);
//       await expect(tokenBonding.deployTransaction)
//         .to.emit(tokenBonding, "TokenAdded")
//         .withArgs(tokens[0], coefficients[0])
//         .and.to.emit(tokenBonding, "TokenAdded")
//         .withArgs(tokens[1], coefficients[1]);
//     });
//   });

//   describe("# initial values", () => {
//     it("startTime is ok", async () => {
//       expect(await tokenBonding.startTime()).to.be.equal(startTime);
//     });

//     it("name, symbol, decimals are ok", async () => {
//       expect(await tokenBonding.name()).to.be.equal("veHELIO");
//       expect(await tokenBonding.symbol()).to.be.equal("veHELIO");
//       expect(await tokenBonding.decimals()).to.be.equal(18);
//     });

//     it("allowance should be 0", async () => {
//       expect(await tokenBonding.allowance(AddressZero, AddressZero)).to.be.equal(0);
//     });

//     it("initial coefficients are ok", async () => {
//       const helioInfo = await tokenBonding.tokenInfo(helio.address);
//       const helioLpInfo = await tokenBonding.tokenInfo(helioLp.address);

//       expect(helioInfo.coefficient).to.be.equal(helioCoefficient);
//       expect(helioLpInfo.coefficient).to.be.equal(helioLpCoefficient);
//     });
//   });

//   describe("# transfers and approve should revert", () => {
//     it("'transfer', 'transferFrom', 'approve' functions revert", async () => {
//       await expect(tokenBonding.transfer(AddressZero, 0)).to.eventually.be.rejectedWith(
//         Error,
//         "NON-TRANSFERABLE TOKEN"
//       );

//       await expect(
//         tokenBonding.transferFrom(AddressZero, AddressZero, 0)
//       ).to.eventually.be.rejectedWith(Error, "NON-TRANSFERABLE TOKEN");

//       await expect(tokenBonding.approve(AddressZero, 0)).to.eventually.be.rejectedWith(
//         Error,
//         "NON-TRANSFERABLE TOKEN"
//       );
//     });
//   });

//   describe("# tokenInfo", () => {
//     it("should revert if tokens is not supported", async () => {
//       await expect(tokenBonding.tokenInfo(AddressZero)).to.eventually.be.rejected;
//     });
//   });

//   describe("# add bonding token", () => {
//     it("only owner can call addToken function", async () => {
//       await expect(
//         tokenBonding.connect(signer3).addToken(AddressZero, 0)
//       ).to.eventually.be.rejectedWith(Error, "Ownable: caller is not the owner");
//     });

//     it("adding token works correctly", async () => {
//       // deploy net token
//       const FakeToken = await ethers.getContractFactory("FakeERC20");
//       const newToken = await FakeToken.connect(deployer).deploy("New Token", "New");
//       await newToken.deployed();

//       const newCoefficient = tenPow18.mul(15).div(10);

//       const tokenLengthBefore = await tokenBonding.getTokensLength();

//       await expect(tokenBonding.connect(deployer).addToken(newToken.address, newCoefficient))
//         .to.emit(tokenBonding, "TokenAdded")
//         .withArgs(newToken.address, newCoefficient);

//       const tokenLengthAfter = await tokenBonding.getTokensLength();
//       const tokenInfo = await tokenBonding.tokenInfo(newToken.address);
//       const tokenInfoByIndex = await tokenBonding.getTokenInfoByIndex(tokenInfo.index);

//       expect(tokenLengthAfter).to.be.equal(tokenLengthBefore.add(1));
//       expect(tokenInfo.coefficient).to.be.equal(newCoefficient);
//       expect(await tokenBonding.getTokenByIndex(tokenLengthAfter)).to.be.equal(newToken.address);

//       // check equality of token info
//       expect(tokenInfo.coefficient).to.be.equal(tokenInfoByIndex.coefficient);
//       expect(tokenInfo.index).to.be.equal(tokenInfoByIndex.index);
//       expect(tokenInfo.totalStaked).to.be.equal(tokenInfoByIndex.totalStaked);
//     });

//     it("cannot add already added token", async () => {
//       const FakeToken = await ethers.getContractFactory("FakeERC20");
//       const newToken = await FakeToken.connect(deployer).deploy("New Token", "New");
//       await newToken.deployed();

//       const newCoefficient = tenPow18.mul(15).div(10);

//       await tokenBonding.connect(deployer).addToken(newToken.address, newCoefficient);
//       await expect(
//         tokenBonding.connect(deployer).addToken(newToken.address, newCoefficient)
//       ).to.eventually.be.rejectedWith(Error, "Token already added");
//     });
//   });

//   describe("# bonding", () => {
//     const bondingAmount = BigNumber.from("10000");

//     it("cannot bond if contract is not started yet", async () => {
//       await expect(
//         tokenBonding.connect(signer1).bond(helio.address, bondingAmount)
//       ).to.eventually.be.rejectedWith(Error, "Contract is not started yet");
//     });

//     it("cannot bond zero tokens", async () => {
//       await setStartContractTimestamp();

//       await expect(
//         tokenBonding.connect(signer1).bond(helio.address, 0)
//       ).to.eventually.be.rejectedWith(Error, "cannot bond zero amount");
//     });

//     it("cannot bond if token is not approved", async () => {
//       await setStartContractTimestamp();

//       await expect(
//         tokenBonding.connect(signer1).bond(helio.address, bondingAmount)
//       ).to.eventually.be.rejectedWith(Error, "ERC20: insufficient allowance");
//     });

//     it("cannot bond unsupported token", async () => {
//       await setStartContractTimestamp();

//       const FakeToken = await ethers.getContractFactory("FakeERC20");
//       const wrongToken = await FakeToken.connect(deployer).deploy("Wrong Token", "Wrong");
//       await wrongToken.deployed();

//       await wrongToken.mint(signer1.address, bondingAmount);
//       await wrongToken.connect(signer1).approve(tokenBonding.address, bondingAmount);

//       await expect(
//         tokenBonding.connect(signer1).bond(wrongToken.address, bondingAmount)
//       ).to.eventually.be.rejectedWith(Error, "Unsupported Token");
//     });

//     it("cannot batch bond if tokens length is not equal to amounts length", async () => {
//       await setStartContractTimestamp();

//       const bondingAmountHelio = BigNumber.from("10000");
//       const bondingAmountLP = BigNumber.from("20000");

//       // approve
//       await helio.connect(signer1).approve(tokenBonding.address, bondingAmountHelio);
//       await helioLp.connect(signer1).approve(tokenBonding.address, bondingAmountLP);

//       await expect(
//         tokenBonding
//           .connect(signer1)
//           .bondBatch(
//             [helio.address, helioLp.address, AddressZero],
//             [bondingAmountHelio, bondingAmountLP]
//           )
//       ).to.eventually.be.rejectedWith(Error, "tokens length must be equal to amounts length");
//     });

//     it("bonding works", async () => {
//       await setStartContractTimestamp();

//       // approve
//       await helio.connect(signer1).approve(tokenBonding.address, bondingAmount);
//       await helioLp.connect(signer2).approve(tokenBonding.address, bondingAmount);

//       const helioCoeff = (await tokenBonding.tokenInfo(helio.address)).coefficient;
//       const helioLpCoeff = (await tokenBonding.tokenInfo(helioLp.address)).coefficient;

//       const user1VeTokenBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const user2VeTokenBalBefore = await tokenBonding.balanceOf(signer2.address);
//       const user1VeTokenAmt = getVeTokenByCoefficient(bondingAmount, helioCoeff);
//       const user2VeTokenAmt = getVeTokenByCoefficient(bondingAmount, helioLpCoeff);
//       const user1WeightBefore = await tokenBonding.userWeight(signer1.address);
//       const user2WeightBefore = await tokenBonding.userWeight(signer2.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();

//       await expect(tokenBonding.connect(signer1).bond(helio.address, bondingAmount))
//         .to.emit(tokenBonding, "Transfer")
//         .withArgs(AddressZero, signer1.address, user1VeTokenAmt)
//         .and.to.emit(helio, "Transfer")
//         .withArgs(signer1.address, tokenBonding.address, bondingAmount);
//       await expect(tokenBonding.connect(signer2).bond(helioLp.address, bondingAmount))
//         .to.emit(tokenBonding, "Transfer")
//         .withArgs(AddressZero, signer2.address, user2VeTokenAmt)
//         .and.to.emit(helioLp, "Transfer")
//         .withArgs(signer2.address, tokenBonding.address, bondingAmount);

//       const expectedUser1VeTokenBal = user1VeTokenAmt.add(user1VeTokenBalBefore);
//       const expectedUser2VeTokenBal = user2VeTokenAmt.add(user2VeTokenBalBefore);
//       const expectedUser1Weight = user1VeTokenAmt.add(user1WeightBefore);
//       const expectedUser2Weight = user2VeTokenAmt.add(user2WeightBefore);
//       const expectedTotalSupply = totalSupplyBefore.add(user1VeTokenAmt).add(user2VeTokenAmt);
//       const expectedTotalWeight = totalWeightBefore.add(user1VeTokenAmt).add(user2VeTokenAmt);

//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(expectedUser1VeTokenBal);
//       expect(await tokenBonding.balanceOf(signer2.address)).to.be.equal(expectedUser2VeTokenBal);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUser1Weight);
//       expect(await tokenBonding.userWeight(signer2.address)).to.be.equal(expectedUser2Weight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(expectedTotalSupply);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });

//     it("batch bonding works", async () => {
//       await setStartContractTimestamp();

//       const bondingAmountHelio = BigNumber.from("10000");
//       const bondingAmountLP = BigNumber.from("20000");

//       // approve
//       await helio.connect(signer1).approve(tokenBonding.address, bondingAmountHelio);
//       await helioLp.connect(signer1).approve(tokenBonding.address, bondingAmountLP);

//       const helioCoeff = (await tokenBonding.tokenInfo(helio.address)).coefficient;
//       const helioLpCoeff = (await tokenBonding.tokenInfo(helioLp.address)).coefficient;

//       const veTokenBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();

//       const veTokenAmtByHelio = getVeTokenByCoefficient(bondingAmountHelio, helioCoeff);
//       const veTokenAmtByLP = getVeTokenByCoefficient(bondingAmountLP, helioLpCoeff);

//       await expect(
//         tokenBonding
//           .connect(signer1)
//           .bondBatch([helio.address, helioLp.address], [bondingAmountHelio, bondingAmountLP])
//       )
//         .to.emit(tokenBonding, "Transfer")
//         .withArgs(AddressZero, signer1.address, veTokenAmtByHelio)
//         .and.to.emit(tokenBonding, "Transfer")
//         .withArgs(AddressZero, signer1.address, veTokenAmtByLP)
//         .and.to.emit(helio, "Transfer")
//         .withArgs(signer1.address, tokenBonding.address, bondingAmountHelio)
//         .and.to.emit(helioLp, "Transfer")
//         .withArgs(signer1.address, tokenBonding.address, bondingAmountLP);

//       const expectedVeTokenBal = veTokenBalBefore.add(veTokenAmtByLP).add(veTokenAmtByHelio);
//       const expectedUserWeight = userWeightBefore.add(veTokenAmtByLP).add(veTokenAmtByHelio);
//       const expectedTotalSupply = totalSupplyBefore.add(veTokenAmtByLP).add(veTokenAmtByHelio);
//       const expectedTotalWeight = totalWeightBefore.add(veTokenAmtByLP).add(veTokenAmtByHelio);

//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(expectedVeTokenBal);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUserWeight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(expectedTotalSupply);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });
//   });

//   describe("# request unbond", () => {
//     const bondingAmount = BigNumber.from("10000");

//     beforeEach("bond tokens", async () => {
//       // start contract
//       await setStartContractTimestamp();

//       // approve
//       await helio.connect(signer1).approve(tokenBonding.address, bondingAmount);
//       await helio.connect(signer2).approve(tokenBonding.address, bondingAmount);
//       await helioLp.connect(signer1).approve(tokenBonding.address, bondingAmount);
//       await helioLp.connect(signer2).approve(tokenBonding.address, bondingAmount);

//       // bond
//       await tokenBonding.connect(signer1).bond(helio.address, bondingAmount);
//       await tokenBonding.connect(signer2).bond(helio.address, bondingAmount);
//       await tokenBonding.connect(signer1).bond(helioLp.address, bondingAmount);
//       await tokenBonding.connect(signer2).bond(helioLp.address, bondingAmount);
//     });

//     it("should not request if not bonded yet", async () => {
//       const arithmeticErrorCode = "0x11";
//       await expect(
//         tokenBonding.connect(signer3).requestUnbond(helio.address, bondingAmount)
//       ).to.eventually.be.rejectedWith(Error, arithmeticErrorCode);
//     });

//     it("cannot request 0 amount", async () => {
//       await expect(
//         tokenBonding.connect(signer1).requestUnbond(helio.address, 0)
//       ).to.eventually.be.rejectedWith(Error, "Cannot request for zero amount");
//     });

//     it("cannot request if requested amount is more than bonded amount", async () => {
//       const arithmeticErrorCode = "0x11";

//       const requestedAmount = bondingAmount.add(1);
//       await expect(
//         tokenBonding.connect(signer1).requestUnbond(helio.address, requestedAmount)
//       ).to.eventually.be.rejectedWith(Error, arithmeticErrorCode);
//     });

//     it("cannot request unbond batch if tokens length is not equal to amounts length", async () => {
//       await expect(
//         tokenBonding.connect(signer1).requestUnbondBatch([helio.address], [])
//       ).to.eventually.be.rejectedWith(Error, "tokens length must be equal to amounts length");
//     });

//     it("request works as expected", async () => {
//       const requestedAmount = bondingAmount.div(2);
//       const user1BalBefore = await tokenBonding.balanceOf(signer1.address);
//       const user2BalBefore = await tokenBonding.balanceOf(signer2.address);
//       const user1WeightBefore = await tokenBonding.userWeight(signer1.address);
//       const user2WeightBefore = await tokenBonding.userWeight(signer2.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();

//       const user1RequestedVeAmount = getVeTokenByCoefficient(requestedAmount, helioCoefficient);
//       const user2RequestedVeAmount = getVeTokenByCoefficient(requestedAmount, helioLpCoefficient);

//       await expect(
//         tokenBonding.connect(signer1).requestUnbond(helio.address, requestedAmount)
//       ).to.emit(tokenBonding, "UnbondingRequest");
//       await expect(
//         tokenBonding.connect(signer2).requestUnbond(helioLp.address, requestedAmount)
//       ).to.emit(tokenBonding, "UnbondingRequest");

//       const expectedUser1Weight = user1WeightBefore.sub(user1RequestedVeAmount);
//       const expectedUser2Weight = user2WeightBefore.sub(user2RequestedVeAmount);
//       const expectedTotalWeight = totalWeightBefore
//         .sub(user1RequestedVeAmount)
//         .sub(user2RequestedVeAmount);

//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(user1BalBefore);
//       expect(await tokenBonding.balanceOf(signer2.address)).to.be.equal(user2BalBefore);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUser1Weight);
//       expect(await tokenBonding.userWeight(signer2.address)).to.be.equal(expectedUser2Weight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(totalSupplyBefore);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });

//     it("should request all amount if requested amount is uint256 max value", async () => {
//       const requestedAmount = MaxUint256;

//       await expect(
//         tokenBonding.connect(signer1).requestUnbond(helio.address, requestedAmount)
//       ).to.emit(tokenBonding, "UnbondingRequest");

//       const userStakeInfo = await tokenBonding.userStakeInfo(signer1.address, helio.address);
//       expect(userStakeInfo.staked).to.be.equal(0);
//     });

//     it("request batch works as expected", async () => {
//       const requestedAmount = bondingAmount.div(2);
//       const userBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();

//       const userRequestedVeHelio = getVeTokenByCoefficient(requestedAmount, helioCoefficient);
//       const userRequestedVeHelioLp = getVeTokenByCoefficient(requestedAmount, helioLpCoefficient);

//       await expect(
//         tokenBonding
//           .connect(signer1)
//           .requestUnbondBatch([helio.address, helioLp.address], [requestedAmount, requestedAmount])
//       )
//         .to.emit(tokenBonding, "UnbondingRequest")
//         .and.to.emit(tokenBonding, "UnbondingRequest");

//       const expectedUserWeight = userWeightBefore
//         .sub(userRequestedVeHelio)
//         .sub(userRequestedVeHelioLp);
//       const expectedTotalWeight = totalWeightBefore
//         .sub(userRequestedVeHelio)
//         .sub(userRequestedVeHelioLp);

//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(userBalBefore);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUserWeight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(totalSupplyBefore);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });
//   });

//   describe("# unbond", () => {
//     const bondingAmount = BigNumber.from("10000");
//     const requestedAmount = bondingAmount.div(2);

//     beforeEach("bond tokens", async () => {
//       // start contract
//       await setStartContractTimestamp();

//       // approve
//       await helio.connect(signer1).approve(tokenBonding.address, bondingAmount);
//       await helio.connect(signer2).approve(tokenBonding.address, bondingAmount);
//       await helioLp.connect(signer1).approve(tokenBonding.address, bondingAmount);
//       await helioLp.connect(signer2).approve(tokenBonding.address, bondingAmount);

//       // bond
//       await tokenBonding.connect(signer1).bond(helio.address, bondingAmount);
//       await tokenBonding.connect(signer2).bond(helio.address, bondingAmount);
//       await tokenBonding.connect(signer1).bond(helioLp.address, bondingAmount);
//       await tokenBonding.connect(signer2).bond(helioLp.address, bondingAmount);
//     });

//     beforeEach("request unbond", async () => {
//       await tokenBonding.connect(signer1).requestUnbond(helio.address, requestedAmount);
//       await tokenBonding.connect(signer2).requestUnbond(helio.address, requestedAmount);
//       await tokenBonding.connect(signer1).requestUnbond(helioLp.address, requestedAmount);
//       await tokenBonding.connect(signer2).requestUnbond(helioLp.address, requestedAmount);
//     });

//     it("cannot unbond if amount is 0", async () => {
//       await expect(
//         tokenBonding.connect(signer3).unbond(helio.address)
//       ).to.eventually.be.rejectedWith(Error, "Claimed amount should not be zero");
//     });

//     it("cannot unbond if a week is not passed", async () => {
//       const currentTimestamp = await getTimestamp();
//       const userStakeInfo = await tokenBonding.userStakeInfo(signer1.address, helio.address);

//       assert.isTrue(userStakeInfo.requestTime.add(week).gt(currentTimestamp));

//       await expect(
//         tokenBonding.connect(signer1).unbond(helio.address)
//       ).to.eventually.be.rejectedWith(Error, "You should wait seven days");
//     });

//     it("unbonding works", async () => {
//       await advanceTime(week.toNumber());
//       const user1WeightBefore = await tokenBonding.userWeight(signer1.address);
//       const user2WeightBefore = await tokenBonding.userWeight(signer2.address);
//       const user1BalBefore = await tokenBonding.balanceOf(signer1.address);
//       const user2BalBefore = await tokenBonding.balanceOf(signer2.address);
//       const totalWeightBefore = await tokenBonding.totalWeight();
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const user1StakeInfoBefore = await tokenBonding.userStakeInfo(signer1.address, helio.address);
//       const user2StakeInfoBefore = await tokenBonding.userStakeInfo(
//         signer2.address,
//         helioLp.address
//       );
//       const user1VeTokenAmt = getVeTokenByCoefficient(requestedAmount, helioCoefficient);
//       const user2VeTokenAmt = getVeTokenByCoefficient(requestedAmount, helioLpCoefficient);

//       await expect(tokenBonding.connect(signer1).unbond(helio.address))
//         .to.emit(helio, "Transfer")
//         .withArgs(tokenBonding.address, signer1.address, user1StakeInfoBefore.wantClaim)
//         .and.to.emit(tokenBonding, "Transfer")
//         .withArgs(signer1.address, AddressZero, user1VeTokenAmt);
//       await expect(tokenBonding.connect(signer2).unbond(helioLp.address))
//         .to.emit(helioLp, "Transfer")
//         .withArgs(tokenBonding.address, signer2.address, user2StakeInfoBefore.wantClaim)
//         .and.to.emit(tokenBonding, "Transfer")
//         .withArgs(signer2.address, AddressZero, user2VeTokenAmt);

//       const user1StakeInfoAfter = await tokenBonding.userStakeInfo(signer1.address, helio.address);
//       const user2StakeInfoAfter = await tokenBonding.userStakeInfo(
//         signer2.address,
//         helioLp.address
//       );
//       const expectedUser1BalAfter = user1BalBefore.sub(user1VeTokenAmt);
//       const expectedUser2BalAfter = user2BalBefore.sub(user2VeTokenAmt);
//       const expectedTotalSupply = totalSupplyBefore.sub(user1VeTokenAmt).sub(user2VeTokenAmt);

//       expect(user1StakeInfoAfter.wantClaim).to.be.equal(0);
//       expect(user2StakeInfoAfter.wantClaim).to.be.equal(0);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(user1WeightBefore);
//       expect(await tokenBonding.userWeight(signer2.address)).to.be.equal(user2WeightBefore);
//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(expectedUser1BalAfter);
//       expect(await tokenBonding.balanceOf(signer2.address)).to.be.equal(expectedUser2BalAfter);
//       expect(await tokenBonding.totalWeight()).to.be.equal(totalWeightBefore);
//       expect(await tokenBonding.totalSupply()).to.be.equal(expectedTotalSupply);
//     });

//     it("batch unbonding works", async () => {
//       await advanceTime(week.toNumber());
//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const userBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const totalWeightBefore = await tokenBonding.totalWeight();
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const userHelioStakeInfoBefore = await tokenBonding.userStakeInfo(
//         signer1.address,
//         helio.address
//       );
//       const userHelioLPStakeInfoBefore = await tokenBonding.userStakeInfo(
//         signer1.address,
//         helioLp.address
//       );
//       const userVeHelioAmt = getVeTokenByCoefficient(requestedAmount, helioCoefficient);
//       const userVeHelioLpAmt = getVeTokenByCoefficient(requestedAmount, helioLpCoefficient);

//       await expect(tokenBonding.connect(signer1).unbondBatch([helio.address, helioLp.address]))
//         .to.emit(helio, "Transfer")
//         .withArgs(tokenBonding.address, signer1.address, userHelioStakeInfoBefore.wantClaim)
//         .and.to.emit(helio, "Transfer")
//         .withArgs(tokenBonding.address, signer1.address, userHelioLPStakeInfoBefore.wantClaim)
//         .and.to.emit(tokenBonding, "Transfer")
//         .withArgs(signer1.address, AddressZero, userVeHelioAmt)
//         .and.to.emit(tokenBonding, "Transfer")
//         .withArgs(signer1.address, AddressZero, userVeHelioLpAmt);

//       const userHelioStakeInfo = await tokenBonding.userStakeInfo(signer1.address, helio.address);
//       const userHelioLpStakeInfo = await tokenBonding.userStakeInfo(
//         signer1.address,
//         helioLp.address
//       );
//       const expectedUserBal = userBalBefore.sub(userVeHelioAmt).sub(userVeHelioLpAmt);
//       const expectedTotalSupply = totalSupplyBefore.sub(userVeHelioAmt).sub(userVeHelioLpAmt);

//       expect(userHelioStakeInfo.wantClaim).to.be.equal(0);
//       expect(userHelioLpStakeInfo.wantClaim).to.be.equal(0);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(userWeightBefore);
//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(expectedUserBal);
//       expect(await tokenBonding.totalWeight()).to.be.equal(totalWeightBefore);
//       expect(await tokenBonding.totalSupply()).to.be.equal(expectedTotalSupply);
//     });
//   });

//   describe("# decrease unbond amount", () => {
//     const bondingAmount = BigNumber.from("10000");
//     const requestedAmount = bondingAmount.div(2);
//     const decreaseAmount = requestedAmount.div(2);

//     beforeEach("bond tokens", async () => {
//       // start contract
//       await setStartContractTimestamp();

//       // approve
//       await helio.connect(signer1).approve(tokenBonding.address, bondingAmount);
//       await helioLp.connect(signer1).approve(tokenBonding.address, bondingAmount);

//       // bond
//       await tokenBonding.connect(signer1).bond(helio.address, bondingAmount);
//       await tokenBonding.connect(signer1).bond(helioLp.address, bondingAmount);
//     });

//     beforeEach("request unbond", async () => {
//       await tokenBonding.connect(signer1).requestUnbond(helio.address, requestedAmount);
//       await tokenBonding.connect(signer1).requestUnbond(helioLp.address, requestedAmount);
//     });

//     it("cannot decrease more than requested unbond amount", async () => {
//       await expect(
//         tokenBonding.connect(signer1).decreaseUnbondAmount(helio.address, requestedAmount.add(1))
//       ).to.eventually.be.rejectedWith(Error, "amount is more than wantClaim amount");
//     });

//     it("cannot batch decrease amount if tokens length is not equal to amounts length", async () => {
//       await expect(
//         tokenBonding.connect(signer1).decreaseUnbondAmountBatch([helio.address], [])
//       ).to.eventually.be.rejectedWith(Error, "tokens length must be equal to amounts length");
//     });

//     it("decrease unbond amount works", async () => {
//       const userBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();
//       const userVeHelioAmt = getVeTokenByCoefficient(decreaseAmount, helioCoefficient);

//       const userStakeInfoBefore = await tokenBonding.userStakeInfo(signer1.address, helio.address);

//       await expect(
//         tokenBonding.connect(signer1).decreaseUnbondAmount(helio.address, decreaseAmount)
//       )
//         .to.emit(tokenBonding, "UnbondingRequest")
//         .withArgs(
//           helio.address,
//           userStakeInfoBefore.wantClaim.sub(decreaseAmount),
//           userStakeInfoBefore.requestTime
//         );

//       const expectedUserWeight = userWeightBefore.add(userVeHelioAmt);
//       const expectedTotalWeight = totalWeightBefore.add(userVeHelioAmt);

//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(userBalBefore);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUserWeight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(totalSupplyBefore);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });

//     it("will decrease all amounts if the given amount is equal to MaxUint256", async () => {
//       const userBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();
//       const userVeHelioAmt = getVeTokenByCoefficient(requestedAmount, helioCoefficient);

//       const userStakeInfoBefore = await tokenBonding.userStakeInfo(signer1.address, helio.address);

//       await expect(
//         tokenBonding
//           .connect(signer1)
//           .decreaseUnbondAmount(helio.address, ethers.constants.MaxUint256)
//       )
//         .to.emit(tokenBonding, "UnbondingRequest")
//         .withArgs(helio.address, 0, userStakeInfoBefore.requestTime);

//       const expectedUserWeight = userWeightBefore.add(userVeHelioAmt);
//       const expectedTotalWeight = totalWeightBefore.add(userVeHelioAmt);

//       const userStakeInfoAfter = await tokenBonding.userStakeInfo(signer1.address, helio.address);

//       expect(userStakeInfoAfter.wantClaim).to.be.equal(0);
//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(userBalBefore);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUserWeight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(totalSupplyBefore);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });

//     it("decrease unbond batch works", async () => {
//       const decreaseAmount1 = decreaseAmount;
//       const decreaseAmount2 = decreaseAmount.mul(2);
//       const userBalBefore = await tokenBonding.balanceOf(signer1.address);
//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const totalSupplyBefore = await tokenBonding.totalSupply();
//       const totalWeightBefore = await tokenBonding.totalWeight();
//       const userVeHelioAmt = getVeTokenByCoefficient(decreaseAmount1, helioCoefficient);
//       const userVeHelioLpAmt = getVeTokenByCoefficient(decreaseAmount2, helioLpCoefficient);

//       const userHelioStakeInfoBefore = await tokenBonding.userStakeInfo(
//         signer1.address,
//         helio.address
//       );
//       const userHelioLpStakeInfoBefore = await tokenBonding.userStakeInfo(
//         signer1.address,
//         helioLp.address
//       );

//       await expect(
//         tokenBonding
//           .connect(signer1)
//           .decreaseUnbondAmountBatch(
//             [helio.address, helioLp.address],
//             [decreaseAmount1, decreaseAmount2]
//           )
//       )
//         .to.emit(tokenBonding, "UnbondingRequest")
//         .withArgs(
//           helio.address,
//           userHelioStakeInfoBefore.wantClaim.sub(decreaseAmount1),
//           userHelioStakeInfoBefore.requestTime
//         )
//         .and.to.emit(tokenBonding, "UnbondingRequest")
//         .withArgs(
//           helioLp.address,
//           userHelioLpStakeInfoBefore.wantClaim.sub(decreaseAmount2),
//           userHelioLpStakeInfoBefore.requestTime
//         );

//       const expectedUserWeight = userWeightBefore.add(userVeHelioAmt).add(userVeHelioLpAmt);
//       const expectedTotalWeight = totalWeightBefore.add(userVeHelioAmt).add(userVeHelioLpAmt);

//       expect(await tokenBonding.balanceOf(signer1.address)).to.be.equal(userBalBefore);
//       expect(await tokenBonding.userWeight(signer1.address)).to.be.equal(expectedUserWeight);
//       expect(await tokenBonding.totalSupply()).to.be.equal(totalSupplyBefore);
//       expect(await tokenBonding.totalWeight()).to.be.equal(expectedTotalWeight);
//     });
//   });
// });
