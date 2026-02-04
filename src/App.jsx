import React, { useState, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';

function App() {
    const [powerX, setPowerX] = useState(2500);
    const [genA, setGenA] = useState(1600);
    const [maxDepth, setMaxDepth] = useState(6);
    const baseP = 200;

    const R = 0.025;
    const B = 0.5;
    const SECONDS_PER_DAY = 86400;

    const formatSplit = (a, b) => {
        const parts = [];
        if (a > 0) parts.push(<span key="half">1/2 <span className="text-yellow-400 font-bold">{a}</span>개</span>);
        if (b > 0) parts.push(<span key="third">1/3 <span className="text-pink-400 font-bold">{b}</span>개</span>);
        if (parts.length === 0) return <span>없음</span>;
        if (parts.length === 1) return parts[0];
        return <>{parts[0]} <span className="text-gray-500">x</span> {parts[1]}</>;
    };

    const formatBestSingle = (r) => {
        return (
            <div>
                <div className="text-lg font-bold text-white mb-1">1/{r.denom1}</div>
                <div className="text-sm pl-2 border-l-2 border-cyan-500">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">•</span> <span className="text-gray-400">최적해:</span> {formatSplit(r.a, r.b)}
                    </div>
                </div>
            </div>
        );
    };

    const formatBestDual = (r) => {
        return (
            <div>
                <div className="text-lg font-bold text-white mb-1">1/{r.denom1} + 1/{r.denom2}</div>
                <div className="text-sm pl-2 border-l-2 border-cyan-500 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">•</span> <span className="text-gray-400">1/{r.denom1}:</span> {formatSplit(r.a, r.b)}
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">•</span> <span className="text-gray-400">1/{r.denom2}:</span> {formatSplit(r.c, r.d)}
                    </div>
                </div>
            </div>
        );
    };

    const calculation = useMemo(() => {
        const netRequired = Math.max(0, powerX - baseP);
        const fullGens = Math.floor(netRequired / genA);
        const remainder = netRequired % genA;
        const partialRatio = remainder / genA;
        const targetBeltRatio = partialRatio * (R / B);

        return { netRequired, fullGens, remainder, partialRatio, targetBeltRatio };
    }, [powerX, genA, baseP]);

    const results = useMemo(() => {
        const { partialRatio, targetBeltRatio, remainder } = calculation;

        if (remainder === 0 || partialRatio <= 0) {
            return { single: [], dual: [], message: "부분 가동 발전기가 필요 없습니다." };
        }

        const fractions = [];
        for (let a = 0; a <= maxDepth; a++) {
            for (let b = 0; b <= maxDepth - a; b++) {
                if (a === 0 && b === 0) continue;
                const denom = Math.pow(2, a) * Math.pow(3, b);
                fractions.push({ a, b, value: 1 / denom, denom });
            }
        }

        const singleResults = [];
        const dualResults = [];

        for (const f of fractions) {
            if (f.value < targetBeltRatio - 1e-12) continue;
            const actualRatio = f.value * (B / R);
            const batteryUsage = f.value * B;
            singleResults.push({
                a: f.a, b: f.b, c: null, d: null,
                denom1: f.denom, denom2: null,
                beltRatio: f.value,
                actualRatio: Math.min(1, actualRatio),
                batteryUsage,
                k: f.value - targetBeltRatio
            });
        }

        for (let i = 0; i < fractions.length; i++) {
            for (let j = i; j < fractions.length; j++) {
                const f1 = fractions[i];
                const f2 = fractions[j];
                const sum = f1.value + f2.value;
                if (sum < targetBeltRatio - 1e-12 || sum > 1) continue;

                const actualRatio = sum * (B / R);
                const batteryUsage = sum * B;
                dualResults.push({
                    a: f1.a, b: f1.b, c: f2.a, d: f2.b,
                    denom1: f1.denom, denom2: f2.denom,
                    beltRatio: sum,
                    actualRatio: Math.min(1, actualRatio),
                    batteryUsage,
                    k: sum - targetBeltRatio
                });
            }
        }

        singleResults.sort((a, b) => a.k - b.k);
        dualResults.sort((a, b) => a.k - b.k);

        return { single: singleResults.slice(0, 8), dual: dualResults.slice(0, 8), message: null };
    }, [calculation, maxDepth]);

    const { netRequired, fullGens, remainder, partialRatio, targetBeltRatio } = calculation;

    const ResultSection = ({ data, title, isSingle }) => {
        if (!data || data.length === 0) return null;
        const best = data[0];
        const savedPerDay = R * (1 - best.actualRatio) * SECONDS_PER_DAY;

        return (
            <div className="mb-4 p-3 bg-gray-800 rounded">
                <h3 className="font-bold text-cyan-400 mb-2">{title}</h3>
                <div className="p-2 bg-green-900/30 rounded mb-2">
                    <div className="font-mono">
                        {isSingle ? formatBestSingle(best) : formatBestDual(best)}
                    </div>
                    <div className="text-xs mt-2 pt-2 border-t border-gray-700 grid grid-cols-2 gap-1">
                        <span>부분기 가동률: <span className="text-yellow-300">{(best.actualRatio * 100).toFixed(2)}%</span></span>
                        <span>부분기 배터리: <span className="text-orange-400">{best.batteryUsage.toFixed(5)}/s</span></span>
                        <span>초과 발전량: <span className="text-red-400">{(best.actualRatio * genA - calculation.remainder).toFixed(1)}</span></span>
                        <span>일일 절약량: <span className="text-green-400">{savedPerDay.toFixed(1)}개</span></span>
                    </div>
                </div>
                <table className="w-full text-xs font-mono">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="p-1">#</th>
                            <th className="p-1">비율</th>
                            <th className="p-1">분배기 구성</th>
                            <th className="p-1 text-right">가동률</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((r, i) => (
                            <tr key={i} className={`border-t border-gray-700 ${i === 0 ? 'bg-green-900/20' : ''}`}>
                                <td className="p-1 text-center">{i + 1}</td>
                                <td className="p-1">{isSingle ? `1/${r.denom1}` : `1/${r.denom1}+1/${r.denom2}`}</td>
                                <td className="p-1 text-cyan-300">
                                    {isSingle ? formatSplit(r.a, r.b) : (
                                        <div className="flex flex-col text-xs">
                                            <span>{formatSplit(r.a, r.b)}</span>
                                            <span>{formatSplit(r.c, r.d)}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="p-1 text-right text-yellow-300">{(r.actualRatio * 100).toFixed(2)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="p-4 bg-gray-900 text-gray-100 min-h-screen text-sm">
            <Analytics />
            <h1 className="text-xl font-bold mb-4 text-cyan-400">열에너지 뱅크 최적화</h1>

            <div className="mb-4 p-3 bg-gray-800 rounded grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="block">
                    <span className="text-xs text-gray-400">전력 소비</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={powerX}
                        onChange={e => setPowerX(parseFloat(e.target.value) || 0)}
                        className="block w-full mt-1 px-2 py-1 bg-gray-700 rounded text-yellow-400"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-gray-400">배터리 1개당 발전량</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={genA}
                        onChange={e => setGenA(parseFloat(e.target.value) || 0)}
                        className="block w-full mt-1 px-2 py-1 bg-gray-700 rounded"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-gray-400">최대 분배기 수</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={maxDepth}
                        onChange={e => setMaxDepth(Math.min(20, Math.max(1, parseInt(e.target.value) || 6)))}
                        className="block w-full mt-1 px-2 py-1 bg-gray-700 rounded"
                    />
                </label>
            </div>

            <div className="mb-4 p-3 bg-blue-900/30 rounded border border-blue-700">
                <h2 className="font-bold text-blue-400 mb-2">발전기 구성</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>순 필요량: <span className="text-yellow-400">{netRequired}</span></div>
                    <div>풀 가동 발전기: <span className="text-green-400">{fullGens}대</span></div>
                    <div>나머지 발전량: <span className="text-orange-400">{remainder}</span></div>
                    <div>부분기 가동률: <span className="text-yellow-400">{(partialRatio * 100).toFixed(3)}%</span></div>
                </div>
                <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
                    <div className="text-gray-300">
                        <strong>구성:</strong> 풀 가동 {fullGens}대 (각 0.025/s)
                        {remainder > 0 && <span> + 부분 가동 1대</span>}
                    </div>
                    <div className="text-gray-400 mt-1">
                        풀 가동 배터리: {(fullGens * R).toFixed(4)}/s
                    </div>
                </div>
            </div>

            {results.message ? (
                <div className="p-3 bg-green-900/30 rounded border border-green-600 text-green-300">
                    {results.message}
                    <div className="mt-2 text-sm">
                        총 배터리 소모: <span className="text-red-400">{(fullGens * R).toFixed(4)}/s</span>
                    </div>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    <ResultSection data={results.single} title="열에너지 뱅크 입력부 1개" isSingle={true} />
                    <ResultSection data={results.dual} title="열에너지 뱅크 입력부 2개" isSingle={false} />
                </div>
            )}
        </div>
    );
}

export default App;