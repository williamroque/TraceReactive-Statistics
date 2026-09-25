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
        { name: 'chi2', outputType: 'core:number' },
        { name: 'p_value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'rowColumn', label: 'Row Column', type: 'text' as const, defaultValue: '' },
        { name: 'colColumn', label: 'Col Column', type: 'text' as const, defaultValue: '' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const rowCol = properties['rowColumn'] as string;
        const colCol = properties['colColumn'] as string;
        
        if (!rowCol || !colCol || !table.columnNames().includes(rowCol) || !table.columnNames().includes(colCol)) {
            return {};
        }
        
        const pivotTable = table
            .groupby(rowCol, colCol)
            .count({ as: 'count' })
            .pivot(colCol, { count: aq.op.sum('count') });
            
        const valueCols = pivotTable.columnNames().filter(c => c !== rowCol);
        const matrix: number[][] = [];
        
        for (let r = 0; r < pivotTable.numRows(); r++) {
            const rowArr = [];
            for (const c of valueCols) {
                rowArr.push(Number(pivotTable.get(c, r)) || 0);
            }
            matrix.push(rowArr);
        }
        
        if (matrix.length === 0 || matrix[0].length === 0) return {};
        
        let rowSums = matrix.map(r => r.reduce((a,b) => a+b, 0));
        let colSums = matrix[0].map((_, i) => matrix.reduce((sum, r) => sum + r[i], 0));
        let total = rowSums.reduce((a,b) => a+b, 0);
        
        let chi2 = 0;
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[0].length; j++) {
                let expected = (rowSums[i] * colSums[j]) / total;
                let observed = matrix[i][j];
                if (expected > 0) {
                    chi2 += Math.pow(observed - expected, 2) / expected;
                }
            }
        }
        
        let df = (matrix.length - 1) * (matrix[0].length - 1);
        let pValue = 1 - jStat.chisquare.cdf(chi2, df);
        
        const summary = aq.from([{
            test: 'Chi-Square Independence',
            chi2: chi2,
            p_value: pValue,
            df: df
        }]);
        
        return { Summary: summary, chi2: chi2, p_value: pValue };
    }
}
