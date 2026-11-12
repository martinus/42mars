;redcode-94x
;name Glide X 22
;author Steve Gunnell
;strategy Fast clear
;assert 1

TIME    equ    578
ptr     equ    (head-3)
LEN     equ    (bomb-ptr+2)
DESTIN  equ 997

HOP		equ  	291
DTM 	equ		918 
DST		equ		29959
DSTP	equ		(HOP*3*19326)

dbomb   dat.f   }1 ,    #HOP
dstep   NOP.B   #DSTP,   DSTP
stone   MOV.I   dbomb,  *throw
        MOV.I   dbomb,  @throw
throw   MOV.I   DST,    @DST+HOP
    	ADD.F   dstep,   throw
        DJN.B   stone,   #DTM 

boot    mov     bomb                ,DESTIN
        mov     {boot               ,<boot
		djn.b   -1                  ,#bomb-head
        spl    @boot               ,}4000
		sub.f   boot                ,boot
		dat.f	$0                  ,$0

head    nop    0       ,0
start   sne.i  >ptr    ,>ptr
        seq.i  >ptr    ,>ptr
        slt.ab #LEN    ,ptr
        jmp    start   ,>ptr
        nop    <ptr    ,<ptr
        mov    *bomb   ,>ptr
        mov    *bomb   ,>ptr
        djn.b  start   ,#TIME
        jmp    start   ,}bomb
bomb    spl    #0      ,0

	end  stone
