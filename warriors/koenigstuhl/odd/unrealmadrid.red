;redcode-odd
;name Unreal Madrid
;author G.Labarga
;assert 1
;strategy Redcoders Frenzy Tournament round 21, entry #1.
;startegy These players work hard, not like the Real ones ;)
;strategy Q^4.5->Twin "airbagged" ball bombers / vampiric 1c linear scanner
;strategy Bombers suicide after complete the bombing phase to let the scanner work faster
;strategy When captured, the ball looks itself for the goal and scores.

value equ 3456	; just for Koenigstuhl [CCB]

goal equ value
ball equ value

gate equ (loop-5)
dest equ -(sstep/2)
sstep equ (19*8*2)
sloc1 equ (sptr-8+3000-2)
sloc2 equ (sloc1+4000-(sstep/2))

zero    equ     qbomb
qtab3   equ     qbomb

qbomb   jmp     #qoff           , >qc2
        dat 0,0
	dat 0,0

	djn #0,	#qb1
qtab2   djn #0,	#qb2
        djn #0,	#qb3
for 2
	dat 0,0
rof
bmb:	jmp #(sstep/2),#ball
loop:
ref:	mov.i *0,*dest
	mov.i bmb,@ref
	add.ab #sstep,}ref
	jmz.a {ref,ref		;selfcheck
	mov 1,>-1		;anti-stun/vamp
src1:	dat 0,0

for 3
	dat 0,0
rof
        dat     zero-1          , qa1
qtab1   dat     zero-1          , qa2
for 4
	dat 0,0
rof
boot:
src2:	spl sptr,bmb+6
des1:	spl 2,sloc1+6
des2:	spl 1,sloc2+6
	mov {src1,<des1
	mov {src1,<des1
	mov <src2,<des2
	mov <src2,<des2
gos1:	spl sloc1+3,{0
gos2:	djn.a sloc2+3,#ball
for 4
	dat 0,0
rof
sptr:	jmz #bmb,{0		;scan phase
	seq.f bref,*sptr	;seq.ab #ball,*sptr	;is the ball?
	jmp sptr,<gate
	sub.a sptr,vball
	mov vball,*sptr		;drop vamp bomb over the ball
	mov.a #pit-sptr,vball	;reset pointer
	jmp sptr,<gate		;looping for false balls
	dat 0,0
vball:	jmp pit-sptr,<-1
bref:	jmp #0,#ball
for 8
	dat 0,0
rof
pit:	jmz #bmb,{0		;The ball's process looks for the goal
	sne.ab #goal,*pit
	mov 2,*pit		;and kills it
	jmp -3,<gate
for 6
	dat 0,0
rof

;------- Q^4.5 ------
qc2     equ ((1+(qtab3-qptr)*qy)%CORESIZE)
qb1     equ ((1+(qtab2-1-qptr)*qy)%CORESIZE)
qb2     equ ((1+(qtab2-qptr)*qy)%CORESIZE)
qb3     equ ((1+(qtab2+1-qptr)*qy)%CORESIZE)
qa1     equ ((1+(qtab1-1-qptr)*qy)%CORESIZE)
qa2     equ ((1+(qtab1-qptr)*qy)%CORESIZE)
qz      equ 2108
qy      equ 243         ;qy*(qz-1)=1

;q0 mutation
qgo     sne     qptr+qz*qc2     , qptr+qz*qc2+qb2
        seq     <qtab3          , qptr+qz*(qc2-1)+qb2
        jmp     q0              , }q0
        sne     qptr+qz*qa2     , qptr+qz*qa2+qb2
        seq     <qtab1          , qptr+qz*(qa2-1)+qb2
        jmp     q0              , {q0
        sne     qptr+qz*qa1     , qptr+qz*qa1+qb2
        seq     <(qtab1-1)      , qptr+qz*(qa1-1)+qb2
        djn.a   q0              , {q0
                                        ;q1 mutation
        sne     qptr+qz*qb3     , qptr+qz*qb3+qb3
        seq     <(qtab2+1)      , qptr+qz*(qb3-1)+(qb3-1)
        jmp     q0              , }q1
        sne     qptr+qz*qb1     , qptr+qz*qb1+qb1
        seq     <(qtab2-1)      , qptr+qz*(qb1-1)+(qb1-1)
        jmp     q0              , {q1

        sne     qptr+qz*qb2     , qptr+qz*qb2+qb2
        seq     <qtab2          , qptr+qz*(qb2-1)+(qb2-1)
        jmp     q0
                                        ;qz mutation
        seq     >qptr           , qptr+qz+(qb2-1)
        jmp     q2              , <qptr
                                        ;q0 mutation
        seq     qptr+(qz+1)*(qc2-1),qptr+(qz+1)*(qc2-1)+(qb2-1)
        jmp     q0              , }q0
        seq     qptr+(qz+1)*(qa2-1),qptr+(qz+1)*(qa2-1)+(qb2-1)
        jmp     q0              , {q0
        seq     qptr+(qz+1)*(qa1-1),qptr+(qz+1)*(qa1-1)+(qb2-1)
        djn.a   q0              , {q0
        jmz.f   boot           , qptr+(qz+1)*(qb2-1)+(qb2-1)

qoff    equ     -86
qstep   equ     -7
qtime   equ     19

q0      mul.b   *2              , qptr
q2      sne     {qtab1          , @qptr
q1      add.b   qtab2           , qptr
        mov     qtab3           , @qptr
qptr    mov     qbomb           , }qz
        sub     #qstep          , qptr
        djn     -3              , #qtime
        jmp boot,#ball

end qgo


