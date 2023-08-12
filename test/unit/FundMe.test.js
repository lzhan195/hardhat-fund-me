const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")

describe("FundMe", function () {
    let fundMe
    let deployer
    let mockV3Aggregator
    const sendValue = ethers.utils.parseEther("1")
    beforeEach(async function () {
        //cosnt accounts = await ethers.getSigners()
        //const accountZero = accounts[0]
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        mockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        )
    })

    describe("constructor", function () {
        it("sets the aggregator addresses correctly", async function () {
            const response = await fundMe.priceFeed()
            assert.equal(response, mockV3Aggregator.address)
        })
    })

    describe('fund', function () {
        it('fails if you dont send enough eth', async function () {
            await expect(fundMe.fund()).to.be.revertedWith(
                'You need to spend more ETH!');
        })
        it("updated the amount funded data structure", async function () {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.addressToAmountFunded(
                deployer
            )
            assert.equal(response.toString(), sendValue.toString())
        })
        it("Add funder to array of funders", async function () {
            await fundMe.fund({ value: sendValue })
            const funder = await fundMe.funders(0)
            assert.equal(funder, deployer)
        })
    })

    describe('withdraw', function () {
        beforeEach(async function () {
            await fundMe.fund({ value: sendValue })
        })

        it("withdraw ETH from a single funder", async function () {
            //Arrange
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            )
            //Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            )
            //Assert
            assert.equal(endingFundMeBalance, 0)
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString())

        })
        it("allows us to withdraw with multiple funders", async function () {
            //Arrange
            const accounts = await ethers.getSigners()
            for (let i = 1; i < 6; i++) {
                let fundMeConnectedContract = await fundMe.connect(
                    accounts[i])
                await fundMeConnectedContract.fund({ value: sendValue })
            }
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            )

            //Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            )

            //Assert
            assert.equal(endingFundMeBalance, 0)
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString())

            //Make sure that the funders are reset properly
            await expect(fundMe.funders(0)).to.be.reverted

            for (let i = 1; i < 6; i++) {
                assert.equal(
                    await fundMe.addressToAmountFunded(accounts[0].address),
                    0
                )
            }
        })
        it("Only allows the owner to withdraw", async function () {
            const accounts = await ethers.getSigners()
            const attacker = accounts[1]
            const attackerConnectedContract = await fundMe.connect(attacker)
            await expect(
                attackerConnectedContract.withdraw()
            ).to.be.revertedWith("FundMe_NotOwner")
        })
    })
})