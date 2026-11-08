;redcode-94
;name Imp
;author A. K. Dewdney
;strategy The original from 1984: copies itself one cell ahead, forever.
;strategy It never dies by itself and rarely kills anything.
;assert 1
imp     mov.i   imp, imp+1
        end     imp
