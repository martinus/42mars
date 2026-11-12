;redcode-94x
;name Kenshin 4X 17
;author Steve Gunnell
;strategy Mirage style scanner clearing from the scan loop.
;strategy Booting away from a pre-bomb.
;assert 1

STEP  equ  39953
START equ  43507
LEAP  equ  (head+48401)
bptr  equ  (head-2)
IMPNUM equ 49153

DSTP   equ (2030*8)
DST    equ 17932
HOP    equ 2974
TIME   equ 2998

dbomb   dat.f   {-1,    #HOP
stone   NOP.B   #DSTP,   DSTP
loop    MOV.I   dbomb,  *throw
        MOV.I   dbomb,  @throw
throw   MOV.I   DST,    @DST+HOP
    	ADD.F   stone,   throw
        DJN.B   loop,    #TIME
bgo     mov.i  >boot    ,}boot
boot    spl    LEAP     ,head
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        mov.i  >boot    ,}boot
        sub.f  boot     ,boot
        dat.f  0        ,0

head    slt    #START   ,#tail-bptr+5
        mov.a  head     ,bptr
trash   mov    *tail    ,}bptr
        add.a  #STEP    ,@hptr
        jmz.f  trash    ,*head
hptr    jmn.a  @hptr   ,head
        jmp    @hptr   ,}tail
tail    spl    #0       ,}0
        stp.b <0, #0
        dat.f $0, $0
        dat }1, >1
        nop <0, 0

        end    bgo
