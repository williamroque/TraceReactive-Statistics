import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

interface Ranked { val: number }

function assignRanks(sorted: Ranked[]): number[] {
    const n = sorted.length;
    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
        let j = i + 1;
        while (j < n && sorted[j].val === sorted[i].val) j++;
        const avg = (i + 1 + j) / 2;
        for (let k = i; k < j; k++) ranks[k] = avg;
        i = j;
    }
    return ranks;
}

function tiesSum(sorted: Ranked[]): number {
    let sum = 0;
    let i = 0;
    while (i < sorted.length) {
        let j = i + 1;
        while (j < sorted.length && sorted[j].val === sorted[i].val) j++;
        const t = j - i;
        sum += t * t * t - t;
        i = j;
    }
    return sum;
}

export class NonParametricTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:nonparametric';
    readonly displayName = 'Non-Parametric Test';
    readonly visible = true;

    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];

    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'Statistic', outputType: 'core:number' },
        { name: 'P-Value', outputType: 'core:number' }
    ];

    readonly properties = [
        { name: 'testType', label: 'Test Type', type: 'select' as const, options: [
            { label: 'Mann-Whitney U', value: 'mann-whitney' },
            { label: 'Wilcoxon Signed-Rank', value: 'wilcoxon' },
            { label: 'Kruskal-Wallis', value: 'kruskal-wallis' }
        ], defaultValue: 'mann-whitney' },
        { name: 'col1', label: 'Column 1 / Value Column', type: 'string' as const, defaultValue: '' },
        { name: 'col2', label: 'Column 2 (paired / two-group mode)', type: 'string' as const, defaultValue: '' },
        { name: 'groupCol', label: 'Group Column', type: 'string' as const, defaultValue: '' },
        { name: 'mu0', label: 'Hypothetical Median (Wilcoxon 1-sample)', type: 'number' as const, defaultValue: 0 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const testType = properties['testType'] as string;
        const col1 = properties['col1'] as string;
        const col2 = properties['col2'] as string;
        const groupCol = properties['groupCol'] as string;

        if (!col1 || !table.columnNames().includes(col1)) return {};

        const getNumericArray = (col: string) =>
            Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));

        const getGroups = (): { arr1: number[], arr2: number[], groupNames: [string, string] | null } | null => {
            if (groupCol && table.columnNames().includes(groupCol)) {
                const groups: Record<string, number[]> = {};
                const valArr = Array.from(table.array(col1) as Iterable<number>);
                const grpArr = Array.from(table.array(groupCol));
                for (let i = 0; i < valArr.length; i++) {
                    const v = valArr[i];
                    const g = grpArr[i];
                    if (typeof v === 'number' && !isNaN(v) && g != null) {
                        const key = String(g);
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(v);
                    }
                }
                const keys = Object.keys(groups);
                if (keys.length < 2) return null;
                return { arr1: groups[keys[0]], arr2: groups[keys[1]], groupNames: [keys[0], keys[1]] };
            }
            if (col2 && table.columnNames().includes(col2)) {
                return { arr1: getNumericArray(col1), arr2: getNumericArray(col2), groupNames: null };
            }
            return null;
        };

        // ── Mann-Whitney U ──────────────────────────────────────────────
        if (testType === 'mann-whitney') {
            const groups = getGroups();
            if (!groups) return {};
            const { arr1, arr2, groupNames } = groups;
            if (arr1.length === 0 || arr2.length === 0) return {};

            const combined = arr1.map(v => ({ val: v, group: 1 }))
                .concat(arr2.map(v => ({ val: v, group: 2 })))
                .sort((a, b) => a.val - b.val);

            const ranks = assignRanks(combined);
            const n1 = arr1.length, n2 = arr2.length, N = n1 + n2;

            let R1 = 0;
            for (let i = 0; i < N; i++) if (combined[i].group === 1) R1 += ranks[i];

            const U1 = R1 - (n1 * (n1 + 1)) / 2;
            const U2 = n1 * n2 - U1;
            const U = Math.min(U1, U2);
            const mU = (n1 * n2) / 2;
            const ts = tiesSum(combined);
            const sigmaU = N <= 1 ? 0 : Math.sqrt(n1 * n2 / 12 * ((N + 1) - ts / (N * (N - 1))));
            const z = sigmaU === 0 ? 0 : (U - mU) / sigmaU;
            const pValue = 2 * jStat.normal.cdf(-Math.abs(z), 0, 1);

            const row: any = { Test: 'Mann-Whitney U', Statistic: U, 'P-Value': pValue };
            if (groupNames) {
                row['Group 1'] = `${groupNames[0]} (n=${n1})`;
                row['Group 2'] = `${groupNames[1]} (n=${n2})`;
            }
            return { Summary: aq.from([row]), Statistic: U, 'P-Value': pValue };
        }

        // ── Wilcoxon Signed-Rank ────────────────────────────────────────
        if (testType === 'wilcoxon') {
            let diffs: number[];

            if (col2 && table.columnNames().includes(col2)) {
                // Paired mode: differences = col1 - col2 (row-wise)
                const raw1 = Array.from(table.array(col1) as Iterable<number>);
                const raw2 = Array.from(table.array(col2) as Iterable<number>);
                diffs = [];
                for (let i = 0; i < raw1.length; i++) {
                    if (typeof raw1[i] === 'number' && !isNaN(raw1[i]) &&
                        typeof raw2[i] === 'number' && !isNaN(raw2[i])) {
                        diffs.push(raw1[i] - raw2[i]);
                    }
                }
            } else {
                // One-sample mode: col1 vs mu0
                const mu0 = Number(properties['mu0']) || 0;
                diffs = getNumericArray(col1).map(v => v - mu0);
            }

            const nonZero = diffs.filter(d => d !== 0);
            const n = nonZero.length;
            if (n < 4) return {};

            const indexed = nonZero
                .map(d => ({ val: Math.abs(d), sign: Math.sign(d) }))
                .sort((a, b) => a.val - b.val);

            const ranks = assignRanks(indexed);
            const ts = tiesSum(indexed);

            let Wplus = 0, Wminus = 0;
            for (let i = 0; i < n; i++) {
                if (indexed[i].sign > 0) Wplus += ranks[i];
                else Wminus += ranks[i];
            }

            const W = Math.min(Wplus, Wminus);
            const muW = n * (n + 1) / 4;
            const sigmaW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - ts / 48);
            const z = sigmaW === 0 ? 0 : (W - muW) / sigmaW;
            const pValue = 2 * jStat.normal.cdf(-Math.abs(z), 0, 1);

            const mode = col2 && table.columnNames().includes(col2) ? 'Paired' : '1-Sample';
            const summary = aq.from([{
                Test: `Wilcoxon Signed-Rank (${mode})`,
                'W+': Wplus, 'W-': Wminus, Statistic: W,
                'P-Value': pValue, n
            }]);
            return { Summary: summary, Statistic: W, 'P-Value': pValue };
        }

        // ── Kruskal-Wallis ──────────────────────────────────────────────
        if (testType === 'kruskal-wallis') {
            if (!groupCol || !table.columnNames().includes(groupCol)) return {};

            const groupMap: Record<string, number[]> = {};
            const valArr = Array.from(table.array(col1) as Iterable<number>);
            const grpArr = Array.from(table.array(groupCol));

            for (let i = 0; i < valArr.length; i++) {
                const v = valArr[i];
                const g = grpArr[i];
                if (typeof v === 'number' && !isNaN(v) && g != null) {
                    const key = String(g);
                    if (!groupMap[key]) groupMap[key] = [];
                    groupMap[key].push(v);
                }
            }

            const groupArrays = Object.values(groupMap).filter(g => g.length > 0);
            const k = groupArrays.length;
            if (k < 2) return {};

            const N = groupArrays.reduce((s, g) => s + g.length, 0);
            const combined = groupArrays.flatMap((g, gi) => g.map(v => ({ val: v, gi })))
                .sort((a, b) => a.val - b.val);

            const ranks = assignRanks(combined);
            const ts = tiesSum(combined);

            const groupRankSums = new Array(k).fill(0);
            for (let i = 0; i < N; i++) groupRankSums[combined[i].gi] += ranks[i];

            let H = 0;
            for (let gi = 0; gi < k; gi++) {
                const ni = groupArrays[gi].length;
                H += (groupRankSums[gi] * groupRankSums[gi]) / ni;
            }
            H = (12 / (N * (N + 1))) * H - 3 * (N + 1);

            // Ties correction
            const C = 1 - ts / (N * N * N - N);
            if (C > 0) H /= C;

            const df = k - 1;
            const pValue = 1 - jStat.chisquare.cdf(H, df);

            const groupSummary = Object.entries(groupMap).map(([name, arr]) => ({
                Group: name, n: arr.length
            }));

            return {
                Summary: aq.from([{ Test: 'Kruskal-Wallis H', Statistic: H, 'P-Value': pValue, DOF: df, Groups: k }]),
                'Group Sizes': aq.from(groupSummary),
                Statistic: H,
                'P-Value': pValue
            };
        }

        return {};
    }
}
