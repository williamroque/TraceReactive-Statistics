import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

export class ChiSquareTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:chisquare';
    readonly displayName = 'Chi-Square Test';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'Chi2', outputType: 'core:number' },
        { name: 'P-Value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'rowColumn', label: 'Row Column', type: 'string' as const, defaultValue: '' },
        { name: 'colColumn', label: 'Col Column', type: 'string' as const, defaultValue: '' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const rowCol = properties['rowColumn'] as string;
        const colCol = properties['colColumn'] as string;
        
        if (!rowCol || !colCol || !table.columnNames().includes(rowCol) || !table.columnNames().includes(colCol)) {
            return {};
        }
        
        const rowVals = Array.from(table.array(rowCol));
        const colVals = Array.from(table.array(colCol));
        
        const rowCategoriesMap = new Map<string, number>();
        const colCategoriesMap = new Map<string, number>();
        
        const validPairs: [string, string][] = [];
        for (let i = 0; i < rowVals.length; i++) {
            const r = rowVals[i];
            const c = colVals[i];
            if (r != null && c != null && r !== '' && c !== '') {
                const rStr = String(r);
                const cStr = String(c);
                if (!rowCategoriesMap.has(rStr)) rowCategoriesMap.set(rStr, rowCategoriesMap.size);
                if (!colCategoriesMap.has(cStr)) colCategoriesMap.set(cStr, colCategoriesMap.size);
                validPairs.push([rStr, cStr]);
            }
        }
        
        const numRows = rowCategoriesMap.size;
        const numCols = colCategoriesMap.size;
        
        if (numRows < 2 || numCols < 2 || validPairs.length === 0) return {};
        
        const matrix: number[][] = Array.from({ length: numRows }, () => new Array(numCols).fill(0));
        for (const [rStr, cStr] of validPairs) {
            const rIdx = rowCategoriesMap.get(rStr)!;
            const cIdx = colCategoriesMap.get(cStr)!;
            matrix[rIdx][cIdx]++;
        }
        
        const rowSums = matrix.map(r => r.reduce((a, b) => a + b, 0));
        const colSums = matrix[0].map((_, i) => matrix.reduce((sum, r) => sum + r[i], 0));
        const total = rowSums.reduce((a, b) => a + b, 0);
        if (total === 0) return {};
        
        let chi2 = 0;
        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numCols; j++) {
                const expected = (rowSums[i] * colSums[j]) / total;
                const observed = matrix[i][j];
                if (expected > 0) {
                    chi2 += Math.pow(observed - expected, 2) / expected;
                }
            }
        }
        
        const df = (numRows - 1) * (numCols - 1);
        const pValue = 1 - jStat.chisquare.cdf(chi2, df);
        
        const summary = aq.from([{
            Test: 'Chi-Square Independence',
            Chi2: chi2,
            'P-Value': pValue,
            DOF: df
        }]);
        
        return { Summary: summary, Chi2: chi2, 'P-Value': pValue };
    }
}
