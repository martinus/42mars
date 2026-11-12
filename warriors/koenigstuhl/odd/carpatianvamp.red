;redcode-rf21
;name Carpatian Vampires FC
;author G.Labarga
;assert 1
;strategy Redcoders Frenzy Tournament round 21, entry #2.
;strategy Q^4.5->vampires & vampiric 1c linear scanner
;strategy Captured processes are sent to the vampire#2, increasing the speed of its infinite bombing loop
;strategy Vampire#1 starts the ball search after the first pass.
;strategy When captured, the ball looks itself for the goal and scores.

value equ 3456  ; just for Koenigstuhl [CCB]

goal equ value
ball equ value

gate equ (sptr-95)
vstep equ (19*10)
vdist equ (4000-2)
vloc1 equ (sptr+7+1500)
vloc2 equ (vloc1+vdist)

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
;--- vampire 1
st1:	mov vbmb1,@vbmb1
	sub.f (st1+vdist),vbmb1
	djn.b -2,#800	;2400?
	jmz.b >0,sptr-vloc1+1
vbmb1:	jmp (st1-vstep+vdist),vstep

;--- vampire 2
vamp:	spl #vstep,<-vstep	;<- captured processes jump here
st2:	mov vbmb2,@vbmb2
	sub.f vamp,vbmb2
	jmp -2,<-10
vbmb2:	jmp vamp-vstep-4,vstep+4

        dat     zero-1          , qa1
qtab1   dat     zero-1          , qa2
for 7
	dat 0,0
rof
boot:
btpt2:	mov vbmb2, vloc2
btpt1:	mov vbmb1, vloc1
lch:	spl 1,     vloc2-3
	mov {btpt1,<btpt1
	mov {btpt1,<btpt1
	mov {btpt2,<btpt2
	mov {btpt2,<btpt2
	djn.a @lch ,#ball
bref:	jmp #0,#ball
for 4
	dat 0,0
rof
sptr:	jmz #st1,{0		;scan phase
	seq.f bref,*sptr	;is the ball?
	jmp sptr,<gate
	sub.a sptr,vball
	mov vball,*sptr		;drop vamp bomb over the ball
	mov.a #pit-sptr,vball
	jmp sptr,<gate
	dat 0,0
vball:	jmp pit-sptr,<-1
for 4
	dat 0,0
rof
pit:	jmz #st1,{0		;The ball's process looks for the goal
	sne.ab #goal,*pit
	mov 3,*pit		;and kills it
	jmp -3,<gate
for 8
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



