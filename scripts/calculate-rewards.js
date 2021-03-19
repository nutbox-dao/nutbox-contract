let distributionEras = [
    {
        'hasPassed': false,
        'amount': 20,
        'startHeight': 101,
        'stopHeight': 200
    },
    {
        'hasPassed': false,
        'amount': 10,
        'startHeight': 201,
        'stopHeight': 300
    },
    {
        'hasPassed': false,
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
        if (distributionEras[i].hasPassed === true) {
            if(from <= distributionEras[i].stopHeight) {
                throw Error('Era ' + i + ' already passed');
            }
            continue;
        }

        if (to <= distributionEras[i].stopHeight) {
            if(to === distributionEras[i].stopHeight) {
                distributionEras[i].hasPassed = true;
            }
            rewards += (to - rewardedBlock)*distributionEras[i].amount;
            rewardedBlock = to;
            return rewards;
        } else {
            distributionEras[i].hasPassed = true;
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