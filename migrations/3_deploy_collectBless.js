const CollectBless = artifacts.require("CollectBless");
const BlessCard = artifacts.require("BlessCard");
const Random = artifacts.require("Random");
const Utils = artifacts.require("Utils");
const Strings = artifacts.require("Strings");
const ERC20PresetMinterPauser = artifacts.require("ERC20PresetMinterPauser");
const ERC1155PresetMinterPauser = artifacts.require("ERC1155PresetMinterPauser");
const ERC721PresetMinterPauserAutoId = artifacts.require("ERC721PresetMinterPauserAutoId");

module.exports = async function (deployer, network) {
    try {
        await Random.at(Random.address);
    } catch (e) {
        await deployer.deploy(Random);
    }

    try {
        await Utils.at(Utils.address);
    } catch (e) {
        await deployer.deploy(Utils);
    }

    try {
        await Strings.at(Strings.address);
    } catch (e) {
        await deployer.deploy(Strings);
    }

    await deployer.link(Utils, CollectBless);
    await deployer.deploy(CollectBless);
    await deployer.link(Strings, BlessCard);
    await deployer.deploy(BlessCard, "https://gateway.nutbox.app/ipns/k51qzi5uqu5dk7p615riqdzb88rxk0ghes2xl4uablyuomg4v7p2bokzqtjrku/");

    if (network == "development" || network == "bsctest") {
        try {
            await ERC20PresetMinterPauser.at(ERC20PresetMinterPauser.address);
        } catch (e) {
            await deployer.deploy(ERC20PresetMinterPauser, "Test USDT", "USDT");
        }

        try {
            await ERC1155PresetMinterPauser.at(ERC1155PresetMinterPauser.address);
        } catch (e) {
            await deployer.deploy(ERC1155PresetMinterPauser, "");
        }

        try {
            await ERC721PresetMinterPauserAutoId.at(ERC721PresetMinterPauserAutoId.address);
        } catch (e) {
            await deployer.deploy(ERC721PresetMinterPauserAutoId, "test 721", "T721", "");
        }
    }
}