import { useMemo, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Icon from '@mdi/react';
import { mdiTimerSand } from '@mdi/js';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; // optional

import DataTable from '../../components/data-table';
// import { selectAllCrafts, fetchCrafts } from '../../features/crafts/craftsSlice';
import {
    selectAllBarters,
    fetchBarters,
} from '../../features/barters/bartersSlice';
import { selectAllTraders } from '../../features/settings/settingsSlice';
import ValueCell from '../value-cell';
import CostItemsCell from '../cost-items-cell';
import { formatCostItems, getCheapestItemPrice, getCheapestItemPriceWithBarters } from '../../modules/format-cost-items';
import RewardCell from '../reward-cell';
import { isAnyDogtag, isBothDogtags } from '../../modules/dogtags';

import './index.css';

const priceToUse = 'lastLowPrice';

function BartersTable(props) {
    const { selectedTrader, nameFilter, itemFilter, removeDogtags, showAll } =
        props;
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const settings = useSelector((state) => state.settings);
    const { includeFlea, hasJaeger } = useMemo(() => {
        return {includeFlea: settings.includeFlea, hasJaeger: settings.hasJaeger};
    }, [settings]);
    //const includeFlea = useSelector((state) => state.settings.hasFlea);
    //const hasJaeger = useSelector((state) => state.settings.jaeger);
    const traders = useSelector(selectAllTraders);
    const skippedByLevelRef = useRef(false);

    const barters = useSelector(selectAllBarters);
    const bartersStatus = useSelector((state) => {
        return state.barters.status;
    });

    useEffect(() => {
        let timer = false;
        if (bartersStatus === 'idle') {
            dispatch(fetchBarters());
        }

        if (!timer) {
            timer = setInterval(() => {
                dispatch(fetchBarters());
            }, 600000);
        }

        return () => {
            clearInterval(timer);
        };
    }, [bartersStatus, dispatch]);

    const columns = useMemo(
        () => [
            {
                Header: t('Reward'),
                accessor: 'reward',
                Cell: ({ value }) => {
                    return <RewardCell {...value} />;
                },
            },
            {
                Header: t('Cost'),
                accessor: 'costItems',
                Cell: ({ value }) => {
                    return <CostItemsCell costItems={value} />;
                },
            },
            {
                Header: t('Cost ₽'),
                accessor: 'cost',
                Cell: (props) => {
                    if (props.row.original.cached) {
                        return (
                            <div className="center-content">
                                <Tippy
                                    placement="bottom"
                                    content={t('Flea market prices loading')}
                                >
                                    <Icon
                                        path={mdiTimerSand}
                                        size={1}
                                        className="icon-with-text"
                                    />
                                </Tippy>
                            </div>
                        );
                    }
                    return <ValueCell value={props.value}/>;
                },
            },
            {
                Header: t('Estimated savings'),
                accessor: (d) => Number(d.savings),
                Cell: (props) => {
                    if (props.row.original.cached) {
                        return (
                            <div className="center-content">
                                <Tippy
                                    placement="bottom"
                                    content={t('Flea market prices loading')}
                                >
                                    <Icon
                                        path={mdiTimerSand}
                                        size={1}
                                        className="icon-with-text"
                                    />
                                </Tippy>
                            </div>
                        );
                    }
                    return <ValueCell value={props.value} highlightProfit />;
                },
                sortType: (a, b) => {
                    if (a.sellValue > b.sellValue) {
                        return 1;
                    }

                    if (a.sellValue < b.sellValue) {
                        return -1;
                    }

                    return 0;
                },
            },
            {
                Header: t('InstaProfit'),
                accessor: 'instaProfit',
                Cell: (props) => {
                    if (props.row.original.cached) {
                        return (
                            <div className="center-content">
                                <Tippy
                                    placement="bottom"
                                    content={t('Flea market prices loading')}
                                >
                                    <Icon
                                        path={mdiTimerSand}
                                        size={1}
                                        className="icon-with-text"
                                    />
                                </Tippy>
                            </div>
                        );
                    }
                    return (
                        <ValueCell value={props.value} highlightProfit>
                            <div className="duration-wrapper">
                                {props.row.original.instaProfitSource.vendor.name}
                            </div>
                        </ValueCell>
                    );
                },
                sortType: 'basic',
            },
        ],
        [t],
    );

    const data = useMemo(() => {
        let addedTraders = [];
        skippedByLevelRef.current = false;

        return barters
            .filter((barter) => {
                if (!barter.rewardItems[0]) {
                    return false;
                }

                return true;
            })
            .filter((barter) => {
                if (!itemFilter) {
                    return true;
                }

                for (const requiredItem of barter.requiredItems) {
                    if (requiredItem === null) {
                        continue;
                    }

                    if (requiredItem.item.id === itemFilter) {
                        return true;
                    }
                    if (isBothDogtags(itemFilter) && isAnyDogtag(requiredItem.item.id)) {
                        return true;
                    }
                    if (isBothDogtags(requiredItem.item.id) && isAnyDogtag(itemFilter)) {
                        return true;
                    }
                }

                for (const rewardItem of barter.rewardItems) {
                    if (rewardItem.item.id === itemFilter) {
                        return true;
                    }
                    if (!rewardItem.item.containsItems) continue;
                    for (const contained of rewardItem.item.containsItems) {
                        if (contained.item.id === itemFilter) {
                            return true;
                        }
                    }
                }

                return false;
            })
            .filter((barter) => {
                let trader = barter.trader.normalizedName;
                let level = barter.level;
                /*let [trader, level] = barter.source.split('LL');

                level = parseInt(level);
                trader = trader.trim();*/

                if (
                    !nameFilter &&
                    selectedTrader &&
                    selectedTrader !== 'all' &&
                    selectedTrader !== trader.toLowerCase().replace(/\s/g, '-')
                ) {
                    return false;
                }

                if (showAll) {
                    skippedByLevelRef.current = false;
                }

                if (!showAll && level > traders[trader.toLowerCase()]) {
                    skippedByLevelRef.current = true;
                    return false;
                }

                return true;
            })
            .filter((barter) => {
                if (!nameFilter || nameFilter.length <= 0) {
                    return true;
                }

                const findString = nameFilter.toLowerCase().replace(/\s/g, '');
                for (const requiredItem of barter.requiredItems) {
                    if (requiredItem === null) {
                        continue;
                    }

                    if (
                        requiredItem.item.name
                            .toLowerCase()
                            .replace(/\s/g, '')
                            .includes(findString)
                    ) {
                        return true;
                    }
                }

                for (const rewardItem of barter.rewardItems) {
                    if (
                        rewardItem.item.name
                            .toLowerCase()
                            .replace(/\s/g, '')
                            .includes(findString)
                    ) {
                        return true;
                    }
                }

                return false;
            })
            .map((barterRow) => {
                let cost = 0;

                if (removeDogtags) {
                    for (const requiredItem of barterRow.requiredItems) {
                        if (requiredItem === null) {
                            continue;
                        }

                        if (
                            requiredItem.item.name
                                .toLowerCase()
                                .replace(/\s/g, '')
                                .includes('dogtag')
                        ) {
                            return false;
                        }
                    }
                }

                const costItems = formatCostItems(
                    barterRow.requiredItems,
                    settings,
                    barters,
                    false,
                    showAll,
                );
                costItems.map(
                    (costItem) =>
                        (cost = cost + costItem.price * costItem.count),
                );

                const bestSellTo = barterRow.rewardItems[0].item.sellFor.reduce(
                    (previousSellForObject, sellForObject) => {
                        if (sellForObject.vendor.normalizedName === 'flea-market') {
                            return previousSellForObject;
                        }

                        if (sellForObject.vendor.normalizedName === 'jaeger' && !hasJaeger) {
                            return previousSellForObject;
                        }

                        if (previousSellForObject.priceRUB > sellForObject.priceRUB) {
                            return previousSellForObject;
                        }

                        return sellForObject;
                    },
                    {
                        vendor: {
                            name: 'unkonwn',
                            normalizedName: 'unknown'
                        },
                        priceRUB: 0,
                    },
                );

                let level = barterRow.level;
                /*let [trader, level] = barterRow.source.split('LL');
                trader = trader.trim();*/

                const tradeData = {
                    costItems: costItems,
                    cost: cost,
                    instaProfit: bestSellTo.priceRUB - cost,
                    instaProfitSource: bestSellTo,
                    reward: {
                        sellTo: t('N/A'),
                        sellToNormalized: 'none',
                        name: barterRow.rewardItems[0].item.name,
                        sellValue: 0,
                        source: barterRow.trader.name + ' LL' + level,
                        iconLink:
                            barterRow.rewardItems[0].item.iconLink ||
                            'https://tarkov.dev/images/unknown-item-icon.jpg',
                        itemLink: `/item/${barterRow.rewardItems[0].item.normalizedName}`,
                    },
                    cached: barterRow.cached,
                };

                const bestTrade = barterRow.rewardItems[0].item.sellFor.reduce((prev, current) => {
                    if (current.vendor.normalizedName === 'flea-market') 
                        return prev;
                    if (!hasJaeger && current.vendor.normalizedName === 'jaeger') 
                        return prev;
                    if (!prev) 
                        return current;
                    if (prev.priceRUB < current.priceRUB) 
                        return current;
                    return prev;
                }, false);

                if (
                    (bestTrade && bestTrade.priceRUB > tradeData.reward.value) ||
                    (bestTrade && !includeFlea)
                ) {
                    // console.log(barterRow.rewardItems[0].item.sellTo);
                    tradeData.reward.sellValue = bestTrade.priceRUB;
                    tradeData.reward.sellTo = bestTrade.vendor.name;
                    tradeData.reward.sellToNormalized = bestTrade.vendor.normalizedName;
                }
                
                //tradeData.reward.sellTo = t(tradeData.reward.sellTo)

                const cheapestPrice = getCheapestItemPrice(barterRow.rewardItems[0].item, settings, showAll);
                const cheapestBarter = getCheapestItemPriceWithBarters(barterRow.rewardItems[0].item, barters, settings, showAll);
                if (cheapestPrice.type === 'cash-sell' && cheapestBarter.priceRUB === cost) {
                    tradeData.savings = 0;
                    //tradeData.reward.sellNote = t('Barter only');
                } else if (cheapestPrice.type === 'cash-sell' && cheapestBarter.priceRUB < cost) {
                    tradeData.savings = cheapestBarter.priceRUB - cost;
                    //tradeData.reward.sellNote = t('Barter only');
                } else if (cheapestPrice.type === 'cash-sell') {
                    tradeData.savings = 0;
                } else {
                    tradeData.savings = cheapestPrice.priceRUB - cost;
                }

                return tradeData;
            })
            .filter(Boolean)
            .sort((itemA, itemB) => {
                if (itemB.savings > itemA.savings) {
                    return -1;
                }

                if (itemB.savings < itemA.savings) {
                    return 1;
                }

                return 0;
            })
            .filter((barter) => {
                if (selectedTrader !== 'all') {
                    return true;
                }

                if (selectedTrader === 'all') {
                    return true;
                }

                if (addedTraders.includes(barter.reward.source)) {
                    return false;
                }

                addedTraders.push(barter.reward.source);

                return true;
            });
    }, [
        nameFilter,
        selectedTrader,
        barters,
        includeFlea,
        itemFilter,
        traders,
        hasJaeger,
        t,
        removeDogtags,
        showAll,
        settings,
    ]);

    let extraRow = false;

    if (data.length <= 0) {
        extraRow = t('No barters available for selected filters');
    }

    if (data.length <= 0 && skippedByLevelRef.current) {
        extraRow = (
            <>
                {t('No barters available for selected filters but some were hidden by ')}<Link to="/settings/">{t('your settings')}</Link>
            </>
        );
    }

    if (data.length > 0 && skippedByLevelRef.current) {
        extraRow = (
            <>
                {t('Some barters hidden by ')}<Link to="/settings/">{t('your settings')}</Link>
            </>
        );
    }

    return (
        <DataTable
            columns={columns}
            extraRow={extraRow}
            key="barters-table"
            data={data}
        />
    );
}

export default BartersTable;
