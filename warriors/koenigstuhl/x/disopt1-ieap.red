;redcode-94x
;name Dissolve BX 55
;author Steve Gunnell
;strategy CMP scanner with pre-bomb
;assert 1

CDIST   equ 12
IVAL    equ 293
OFFSET  equ 35710
FIRST   equ scan+OFFSET+IVAL
DJNOFF  equ 33626
DESTIN  equ 10449
SAFE    equ (incr-comp+CDIST+(bptr-comp)+1)
DUPS    equ (0+1)
LOOPS   equ (((CDIST+(bptr-comp))/DUPS)+1)
GATE    equ (IVAL-133)
        for (133==0)
TGT     equ incr
        rof
        for (133>0)
TGT     equ wipe
        rof

        org stone
HOP		equ  	5008
TIME	equ		3 
DST		equ		6370
DSTP	equ		(HOP*3*2678)

dbomb   dat.f   #0 ,    #HOP
dstep   NOP.B   #DSTP,   DSTP
stone   MOV.I   dbomb,  *throw
        MOV.I   dbomb,  @throw
throw   MOV.I   DST,    @DST+HOP
    	ADD.F   dstep,   throw
        DJN.B   stone,   #TIME

boot    mov     incr                ,DESTIN
        mov     {boot               ,<boot
		djn.b   -1                  ,#incr-scan
        spl    @boot               ,}4000
		sub.f   boot                ,boot
		dat.f	$0                  ,$0

scan    sub    incr                 ,comp
comp    cmp    FIRST-CDIST          ,FIRST
        slt.ab #SAFE                ,comp
        djn.f  scan                 ,<scan-1-DJNOFF
bptr    mov.b  comp                 ,#bptr
		mov.i	count				,@bptr
        mov    #LOOPS               ,count
split   mov    bomb                 ,<bptr
        for 0
        mov    bomb                 ,<bptr
        rof
count   djn    split                ,#0
        jmn.a  scan                 ,*0
bomb    spl    #0                   ,>-GATE+1
        mov    TGT                  ,<bomb-1
        for 1
        mov    TGT                  ,<bomb-1
        rof

        for (133 > 0 )
wipe    dat    >-GATE               ,>-GATE
        rof
incr    dat    >-IVAL               ,>-IVAL

        end
 
