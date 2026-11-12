;redcode-94nop
;name Flaking Rust
;author lain
;strategy Qscan -> Oneshot
;strategy Bears high similarity with Leap in the darkness, attacker in the dark and rusty.
;strategy It uses a trick to attack during boot and an a-driven stargate, which should give it a more unique profile.
;date 2025-11-14


;assert 1
org    qscan

        qfac   equ 3651 ; 7491 ; 2187 ; 7051
        qdec   equ 7852 ; 5612 ; 1124 ; 4452 ; qdec = (1+qfac^-1) mod 8000

        qa     equ (qfac*(qtab0-1-qptr)+1)
        qb     equ (qfac*(qtab0-qptr)+1)
        qc     equ (qfac*(qtab1-1-qptr)+1)
        qd     equ (qfac*(qtab1-qptr)+1)
        qe     equ (qfac*(qtab1+1-qptr)+1)
        qf     equ (qfac*(qtab2-qptr)+1)

        qtime  equ 18
        qstep  equ -7
        qgap   equ 87

qdecode mul.b  *q1,          qptr
q0      sne    <qtab0,       @qptr
q1      add.b  qtab1,        qptr
q2      mov    qtab2,        @qptr
qptr    mov    qtab2,        *qdec
        add    #qstep,       qptr
        djn    q2,           #qtime
        jmp    warr,         qc
qtab1   dat    4000,         qd
        dat    4000,         qe

qscan   sne    qptr+qdec*qe, qptr+qdec*qe+qe
        seq    <qtab1+1,     qptr+qdec*(qe-1)+qe-1
        jmp    qdecode,      }q1
        sne    qptr+qdec*qb, qptr+qdec*qb+qd
        seq    <qtab0,       qptr+qdec*(qb-1)+qd
        jmp    qdecode,      {qdecode
        sne    qptr+qdec*qa, qptr+qdec*qa+qd
        seq    <qtab0-1,     qptr+qdec*(qa-1)+qd
        djn.a  qdecode,      {qdecode
        sne    qptr+qdec*qf, qptr+qdec*qf+qd
        seq    <qtab2,       qptr+qdec*(qf-1)+qd
        jmp    qdecode,      }qdecode
        sne    qptr+qdec*qc, qptr+qdec*qc+qc
        seq    <qtab1-1,     qptr+qdec*(qc-1)+qc-1
        jmp    qdecode,      {q1
        sne    qptr+qdec*qd, qptr+qdec*qd+qd
        seq    <qtab1,       qptr+qdec*(qd-1)+qd-1
        jmp    qdecode,      qa
qtab0   jmp    warr,         qb
qtab2   dat    qgap,         qf
	for 7
	dat 0,0
	rof
boot equ 4406
warr z for 0
	rof
	spl 2
	
	for	8
	mov {burger,{bptr
	rof
	bptr	djn	boot,#2
	div.x	#0,-1

for 4
dat 0,0
rof

startp equ 3001

step equ 3671 

scn	add #startp,#step
start	jmz.f -1,>scn
add.ba scn,jumper
	mov clr,>scn
	mov <burger,{jumper
	djn -2,#burger-gate
jumper	jmp @- (19+1%20)
gate	dat burger-gate+1,clr
kill	dat <2667,-gate
stun	spl #burger-gate+1,-gate+kill
clr	spl #burger-gate+1,-gate+stun
	mov.i	@gate,}gate
	mov.i	@gate,}gate
	djn.f -2,<7472
burger	dat 1,0

