;redcode-94nop
;name Two Trick Pony
;author lain
;strategy Qscan -> Moore paper / anti-imp paper
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
	for 8
	dat 0,0
	rof
boot equ 5345
boot2 equ 5453
warr z for 0
	rof
	spl 2
	spl 1
	mov	{pap3,{bptr2
	spl 1
	mov	{pap1,{bptr
	mov	{pap3,{bptr2

bptr	spl	boot2
bptr2	jmp	boot


pap1	spl @6,>5669
	mov }-1,>-1
	spl @0,>1935
	mov }-1,>-1
	mov.i #1,<1
	djn	-1,#4438
	dat 0,0
	dat 0,0
pap3	spl	@9,>1126
	mov }-1,>-1
	mov }-2,>-2
pap2	spl    1191    ,  {x
        mov    }x,         }pap2
        mov    }x+3,       }pap2
x       mov    {x+3,       }pap2
        jmz.f  @x-1,       *x
