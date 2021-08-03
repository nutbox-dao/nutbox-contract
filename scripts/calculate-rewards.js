let distributionEras = [
    {
        'amount': 20,
        'startHeight': 101,
        'stopHeight': 200
    },
    {
        'amount': 10,
        'startHeight': 201,
        'stopHeight': 300
    },
    {
        'amount': 5,
        'startHeight': 301,
        'stopHeight': 10000
    }
];

let rewardedBlock;
function calculate_rewards(from, to) {
    rewardedBlock = from - 1;
    let rewards = 0;

    for (let i = 0; i < distributionEras.length; i++) {
        if (rewardedBlock > distributionEras[i].stopHeight){
            continue;
        }

        if (to <= distributionEras[i].stopHeight) {
            rewards += (to - rewardedBlock)*distributionEras[i].amount;
            return rewards;
        } else {
            rewards += (distributionEras[i].stopHeight - rewardedBlock)*distributionEras[i].amount;
            rewardedBlock = distributionEras[i].stopHeight;
        }
    }
}

let from1 = 101;
let to1 = 250;
console.log('before reward round1, distributions: ', distributionEras);
console.log('from: ', from1, ' - to: ', to1, ' got rewards: ', calculate_rewards(from1, to1), ', rewarded block: ', rewardedBlock);
console.log('after reward round1, distributions: ', distributionEras);

let from2 = 251;
let to2 = 300;
console.log('before reward round2, distributions: ', distributionEras);
console.log('from: ', from2, ' - to: ', to2, ' got rewards: ', calculate_rewards(from2, to2), ', rewarded block: ', rewardedBlock);
console.log('after reward round2, distributions: ', distributionEras);