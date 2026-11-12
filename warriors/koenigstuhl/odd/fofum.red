;redcode-odd
;name FoFum
;author Philip Thorne
;strategy Redcoders Frenzy [Round #10 Tri-Tiny] Entry #3/3
;strategy http://de.geocities.com/fizmo_master/cwt.htm
;strategy
;strategy Fast but in/non-offensive clear. Looking for ties.
;startegy Purpose is to depress scores in favour of FeeFiFo.
;strategy
;assert 1
;       (CORESIZE==800) && (MAXCYCLES==16000)

ptr     EQU     (eclr+4)

clr:    spl     #0,     >(0-(ptr-clr+3))
        mov.i   clr,    <ptr
        mov.i   clr,    <ptr
        mov.i   clr,    <ptr
eclr:   jmp     -3,     }ptr

    end clr

