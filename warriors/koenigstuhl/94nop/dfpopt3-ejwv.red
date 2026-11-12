;redcode-94nop
;name Dried Frog Pills C ejwv
;author Steve Gunnell
;strategy Qscan -> Newtish Stone / Imp
;strategy Another different Qscan and boot
;assert CORESIZE==8000


MARK	equ	}7185
IAWAY	equ	356
SAWAY	equ	3191

HOP	equ	(3+hit-gate1)
gate1   equ     (init-7-dist)
pat     equ     (5*1011)
dist    equ     3

cbomb	dat	}5333	,HOP
; 2 DATS
init    SPL.B   #0,     <stone-pat
stone   SPL.B   #pat,   <-pat
loop    MOV.I   {0+pat, hit-pat
        ADD.F   stone,  loop
hit     DJN.F   loop,   <stone-pat
        MOV.I   init-dist, >gate1
last    DJN.F   -1,     >gate1

      for 8
      dat.f  $0       ,$0
      rof

boot	spl	boot2	,MARK
	mov.i	imp+4	,{dptr
	mov.i	imp+3	,{dptr
	mov.i	imp+2	,{dptr
	mov.i	imp+1	,{dptr
	mov.i	imp	,{dptr
	jmp	*dptr	,MARK*2
boot2	mov.i	init+6	,<dptr
	mov.i	init+5	,<dptr
	mov.i	init+4	,<dptr
	mov.i	init+3	,<dptr
	mov.i	init+2	,<dptr
	mov.i	init+1	,<dptr
	mov.i	init	,<dptr
	spl	@dptr	,MARK*5
	sub.ab	#2	,dptr
	mov.i	cbomb	,<dptr
dptr	div.f	#IAWAY	,#SAWAY
	dat	MARK*4	,MARK*3

      for 22
      dat.f  $0       ,$0
      rof

impy	equ	4506

st	equ	2667
imp	MOV.I	#st	,*0
spin	SPL.B	#st+1	,>prime
prime	MOV.I	imp	,impy-1
	ADD.F	spin	,jump
jump	JMP.B	impy-st-1	,<994

      for 3
      dat.f  $0       ,$0
      rof

;----------------------------------------------
qM       equ     5788
qN       equ     6258
qStep    equ     58
qShf	equ	(1+9)
qTm	equ	1+(qStep/qShf)

null     dat     0,0
qSteps  dat     qStep*2-1 ,qStep*2
qBm	dat	qStep	,}-1
qShfi	dat	qShf	,qShf
qDec    mul.x   #qM     ,#qN

        add.f   qDec    ,qPtr
        sne     *qPtr   ,@qPtr
        add.f   qSteps  ,qPtr
qLp	mov	qBm	,*qPtr
	mov	qBm	,@qPtr
qPtr    mov     0       ,*qStep
	sub.f	qShfi	,qPtr
	djn.b	qLp	,#qTm
        jmp     boot	,MARK

qGo     sne     qPtr+(qM+0)*(qN+0)+qStep*0 ,qPtr+(qM+0)*(qN+0)+qStep*1
        seq     qPtr+(qM+0)*(qN+0)+qStep*2 ,qPtr+(qM+0)*(qN+0)+qStep*3
qJump   jmp     qDec
        sne     qPtr+(qM+1)*(qN+0)+qStep*0 ,qPtr+(qM+1)*(qN+0)+qStep*1
        seq     qPtr+(qM+1)*(qN+0)+qStep*2 ,qPtr+(qM+1)*(qN+0)+qStep*3
qAinc   jmp     qDec ,}qDec
        sne     qPtr+(qM-1)*(qN+0)+qStep*0 ,qPtr+(qM-1)*(qN+0)+qStep*1
        seq     qPtr+(qM-1)*(qN+0)+qStep*2 ,qPtr+(qM-1)*(qN+0)+qStep*3
qAdec   jmp     qDec ,{qDec
        sne     qPtr+(qM+0)*(qN+1)+qStep*0 ,qPtr+(qM+0)*(qN+1)+qStep*1
        seq     qPtr+(qM+0)*(qN+1)+qStep*2 ,qPtr+(qM+0)*(qN+1)+qStep*3
qBinc   jmp     qDec ,>qDec
        sne     qPtr+(qM+0)*(qN-1)+qStep*0 ,qPtr+(qM+0)*(qN-1)+qStep*1
        seq     qPtr+(qM+0)*(qN-1)+qStep*2 ,qPtr+(qM+0)*(qN-1)+qStep*3
qBdec   jmp     qDec ,<qDec
        sne     qPtr+(qM-1)*(qN-1)+qStep*0 ,qPtr+(qM-1)*(qN-1)+qStep*1
        seq     qPtr+(qM-1)*(qN-1)+qStep*2 ,qPtr+(qM-1)*(qN-1)+qStep*3
qFdec   djn.f   qDec ,qDec
        jmp     boot	,MARK

      end    qGo

