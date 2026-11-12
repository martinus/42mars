;redcode
;name ChainGang 1.2
;author Eric J. Schwertfeger
;strategy Vampire & Vampire Hunter that
;strategy is Immune to it's own hunt
;strategy Much improved bombing thanks to
;strategy Julius Andrew Cisek (PitTrap)
;strategy v 1.2 Removed Hunt code as test
;strategy Submitted: @date@
;assert 1
BLANK   DAT     #-3,#-3
LOOP    ADD     INC,WHERE
        JMZ     LOOP,@WHERE
        SLT     #(LOOP-WHERE)-2,WHERE
BLAST   MOV     WHERE,@WHERE
        JMP     LOOP
INC     DAT     #-411,#411
PLOOP2  MOV     WHERE+1,<BLANK
        MOV     WHERE+1,<BLANK
PIT     SPL     0
TAIL    JMP     PLOOP2
WHERE   JMP     PIT-80,80
        END     LOOP
