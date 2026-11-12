;redcode
;name Ju Jit Su
;Tournament: ICWST'90
;Standard: CWS'88
;author Stephen Tavener
;assert 1

start   SPL   6
        MOV # 0,      @ 2
        DJN  -1,        1
        DAT            #-3
        SPL   0
        DAT            #-1
        SUB # 5,        -1
        MOV  -3,      @-2
        JMP  -2

        END   start
