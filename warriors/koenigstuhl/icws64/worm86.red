; published in The Core War Newsletter, Summer 1988
;redcode-86
;name Worm
;author William R. Buckley
;assert 1

        MOV  # 3,        SRC
        MOV  # 11,       DEST
        MOV  # 9,        COUNT
LOOP    MOV  < SRC,    < DEST
        DJN    LOOP,     COUNT
        JMP    DEST+2
SRC     DAT              #0
DEST    DAT              #0
COUNT   DAT              #0

        END

