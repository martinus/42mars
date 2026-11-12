;redcode
;name BackFire 1.70
;author Eric J. Schwertfeger
;strategy It's back :-)  New bomb, camoflage this
;strategy Time.  Does a little better against CMP scanners.
;strategy v 1.60 Dropping bombs to confuse CMP scanners, and to
;strategy v 1.60 get CMP Vampires to bite.
;strategy v 1,61 Oops, 1.60 would shoot itself :-)
;strategy v 1.70 Trying slightly better camoflage, I hope.
;stragety Submitted: @date@
;assert 1
BACK    EQU     4001
WHERE   EQU     (LOOP-4)
BOMB    EQU     (WHERE+2)
START   MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        MOV     <SRC, <DEST
        SPL     @DEST,13
        MOV     1,DEST
        DAT     #0,#13
SPLAT   MOV     TAIL+1,@WHERE
LOOP    ADD     #411,WHERE
        JMZ     SPLAT,@WHERE
        SLT     #(TAIL-WHERE+1),WHERE
        JMP     LOOP,1
        MOV     WHERE,BOMB
        SUB     @WHERE,BOMB
        MOV     TAIL+1,<BOMB
        MOV     TAIL+1,<BOMB
        MOV     TAIL+1,<BOMB
TAIL    JMP     SPLAT,1
        DAT     #4567,#0
SRC     DAT     #0,#0
DEST    DAT     #0,#-BACK

