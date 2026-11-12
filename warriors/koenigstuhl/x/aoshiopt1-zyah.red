;redcode-94x
;name Aoshi AX 25
;author Steve Gunnell
;strategy Fast f-scanner.
;strategy with a pre-bomb.
;assert 1

STEP   equ 21155
GAP1   equ 12
KILL   equ 8
BPTR   equ (top-KILL-1)
SPAN   equ KILL
DSTP   equ (4869*8)
DST    equ 25629
HOP    equ 132
TIME   equ 3
GAP2   equ 113

stone   NOP.B   #DSTP,   DSTP
loop    MOV.I   dbomb,  *throw
        MOV.I   dbomb,  @throw
throw   MOV.I   DST,    @DST+HOP
    	ADD.F   stone,   throw
        DJN.B   loop,    #TIME
		JMP     scan,   <4000
dbomb   dat.f   {-1,    #HOP

    for GAP2
        dat.f   $0 , $0
    rof

top     dat    #0    ,SPAN
for GAP1
        dat.f  $0    ,$0
rof
sptr    mov.b  top   ,BPTR
wipe    mov.i  bomb  ,>BPTR
for KILL
        mov.i  *wipe ,>BPTR
rof
        jmn.f  wipe  ,@BPTR
scan    add.f  incr  ,top
        jmn.f  safe  ,@top
        jmz.f  scan  ,*top
safe    slt.b  top   ,#tail-top+3
        jmp    sptr
        jmn.a  scan  ,top
        jmp    scan  ,}wipe
incr    dat    STEP  ,STEP
bomb    spl    #0    ,}0
        stp.b  >0    ,#0
        nop    0     ,0
        spl    #0    ,}0
        nop    0     ,0
tail    dat.f  $0    ,$0

end loop

