; published in The Core War Newsletter, Spring 1988
;redcode-86
;name Iron
;author Alexander Burtsev, Eugene P. Lilitko & Dmitriy Ryabov
;assert 1

SP      SPL              SP
SPLADR  DAT              #1015
CSPL    DAT              #400
ADDRESS DAT              #15
LOOP    DAT              #7980
START   MOV    SP,       @SPLADR
        ADD    #17,      SPLADR
        DJN    START,    CSPL
IRONING ADD    #1,       ADDRESS
        CMP    SP,       @ADDRESS
        DJN    IRONING,  LOOP
        MOV    #0,       @ADDRESS
        DJN    IRONING,  LOOP
FATAL   MOV    #17,      ADDRESS
        MOV    #7981,    LOOP
COMPARE ADD    #1,       ADDRESS
        MOV    #0,       @ADDRESS
        DJN    COMPARE,  LOOP
SLEEP   JMP    0

        END    START

