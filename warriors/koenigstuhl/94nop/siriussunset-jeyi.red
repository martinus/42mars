;redcode-94nop
;name Sirius Sunset jeyi 
;author Steve Gunnell
;strategy Kliney qscan -> supercharged sunset!
;assert CORESIZE == 8000

;kill Sirius Sunset
;password izxcadahyn

qM       equ     4563
qN       equ     2873
qStep    equ     82
qShf	equ	(1+17)
qTm	equ	(qStep/qShf)+7

pstep0	equ	7555
pstep1	equ	6672
pstep2	equ	2641
pstep3	equ	6461
pstep4	equ	5298
X	equ	21
Y	equ	3425

pGo	spl	}1	,}2
	spl	0	,0
	spl	0	,0
for 2 > 2
	mov.i	<1	,{1
	spl	pstep0*2	,p0+8
rof
for 2 > 1
	mov.i	<1	,{1
	spl	pstep0	,p0+8
rof
for 2 > 0
	mov.i	<1	,{1
	spl	pstep1	,p0+8
rof
	mov.i	<1	,{1
	jmp	pstep2	,p0+8
p0	spl	@0	,}pstep3
	mov.i	}-1	,>-1
	spl	pstep4	,<4
	mov	>3	,}-1
	mov	3	,}X
	mov	2	,}Y
	djn.f	-4	,>4
	dat	<2667	,<5334

for 35-CURLINE
	dat	0	,0
rof

qGo     sne     qPtr+(qM+0)*(qN+0)+qStep*0 ,qPtr+(qM+0)*(qN+0)+qStep*1
        seq     qPtr+(qM+0)*(qN+0)+qStep*2 ,qPtr+(qM+0)*(qN+0)+qStep*3
qJump   jmp     qDec
        sne     qPtr+(qM+1)*(qN+0)+qStep*0 ,qPtr+(qM+1)*(qN+0)+qStep*1
        seq     qPtr+(qM+1)*(qN+0)+qStep*2 ,qPtr+(qM+1)*(qN+0)+qStep*3
qAinc   jmp     qDec ,}qDec
for 0 + 0 > 0
        sne     qPtr+(qM-1)*(qN+0)+qStep*0 ,qPtr+(qM-1)*(qN+0)+qStep*1
        seq     qPtr+(qM-1)*(qN+0)+qStep*2 ,qPtr+(qM-1)*(qN+0)+qStep*3
qAdec   jmp     qDec ,{qDec
rof
for 1 + 1 + 0 + 0 > 0
        sne     qPtr+(qM+0)*(qN+1)+qStep*0 ,qPtr+(qM+0)*(qN+1)+qStep*1
        seq     qPtr+(qM+0)*(qN+1)+qStep*2 ,qPtr+(qM+0)*(qN+1)+qStep*3
qBinc   jmp     qDec ,>qDec
rof
for 0 + 1 + 0 > 0
        sne     qPtr+(qM+0)*(qN-1)+qStep*0 ,qPtr+(qM+0)*(qN-1)+qStep*1
        seq     qPtr+(qM+0)*(qN-1)+qStep*2 ,qPtr+(qM+0)*(qN-1)+qStep*3
qBdec   jmp     qDec ,<qDec
rof
for 0 + 1 + 1 + 0 > 0
        sne     qPtr+(qM-1)*(qN-1)+qStep*0 ,qPtr+(qM-1)*(qN-1)+qStep*1
        seq     qPtr+(qM-1)*(qN-1)+qStep*2 ,qPtr+(qM-1)*(qN-1)+qStep*3
qFdec   djn.f   qDec ,qDec
rof
for 1 
        sne     qPtr+(qM+2)*(qN+0)+qStep*0 ,qPtr+(qM+2)*(qN+0)+qStep*1
        seq     qPtr+(qM+2)*(qN+0)+qStep*2 ,qPtr+(qM+2)*(qN+0)+qStep*3
        jmp     qAinc ,}qDec
rof
for 1 == 1
        sne     qPtr+(qM+1)*(qN+1)+qStep*0 ,qPtr+(qM+1)*(qN+1)+qStep*1
        seq     qPtr+(qM+1)*(qN+1)+qStep*2 ,qPtr+(qM+1)*(qN+1)+qStep*3
        jmp     qBinc ,}qDec
rof
for 1 == 1
        sne     qPtr+(qM+1)*(qN-1)+qStep*0 ,qPtr+(qM+1)*(qN-1)+qStep*1
        seq     qPtr+(qM+1)*(qN-1)+qStep*2 ,qPtr+(qM+1)*(qN-1)+qStep*3
        jmp     qBdec ,}qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN+0)+qStep*0 ,qPtr+(qM-2)*(qN+0)+qStep*1
        seq     qPtr+(qM-2)*(qN+0)+qStep*2 ,qPtr+(qM-2)*(qN+0)+qStep*3
        jmp     qAdec ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM-1)*(qN+1)+qStep*0 ,qPtr+(qM-1)*(qN+1)+qStep*1
        seq     qPtr+(qM-1)*(qN+1)+qStep*2 ,qPtr+(qM-1)*(qN+1)+qStep*3
        jmp     qBinc ,{qDec
rof
for 1 == 1
        sne     qPtr+(qM-2)*(qN-1)+qStep*0 ,qPtr+(qM-2)*(qN-1)+qStep*1
        seq     qPtr+(qM-2)*(qN-1)+qStep*2 ,qPtr+(qM-2)*(qN-1)+qStep*3
        jmp     qFdec ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN+2)+qStep*0 ,qPtr+(qM+0)*(qN+2)+qStep*1
        seq     qPtr+(qM+0)*(qN+2)+qStep*2 ,qPtr+(qM+0)*(qN+2)+qStep*3
        jmp     qBinc ,>qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN-2)+qStep*0 ,qPtr+(qM+0)*(qN-2)+qStep*1
        seq     qPtr+(qM+0)*(qN-2)+qStep*2 ,qPtr+(qM+0)*(qN-2)+qStep*3
        jmp     qBdec ,<qDec
rof
for 1 == 1
        sne     qPtr+(qM-1)*(qN-2)+qStep*0 ,qPtr+(qM-1)*(qN-2)+qStep*1
        seq     qPtr+(qM-1)*(qN-2)+qStep*2 ,qPtr+(qM-1)*(qN-2)+qStep*3
        jmp     qFdec ,<qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN-2)+qStep*0 ,qPtr+(qM-2)*(qN-2)+qStep*1
        seq     qPtr+(qM-2)*(qN-2)+qStep*2 ,qPtr+(qM-2)*(qN-2)+qStep*3
        djn.f   qFdec ,qDec
rof
        jmp     pGo	,<4000

for MAXLENGTH-CURLINE-14
	dat	0	,0
rof

null	dat	0	,0
qSteps	dat	qStep*2-1	,qStep*2
qBm	dat	qStep	,}-1
qShfi	dat	qShf	,qShf
qDec	mul.x	#qM	,#qN

	add.f	qDec	,qPtr
	sne	*qPtr	,@qPtr
	add.f	qSteps	,qPtr
qLp	mov	qBm	,*qPtr
	mov	qBm	,@qPtr
qPtr	mov	0	,*qStep
	sub.f	qShfi	,qPtr
	djn.b	qLp	,#qTm
	jmp	pGo	,<4000

	end	qGo
