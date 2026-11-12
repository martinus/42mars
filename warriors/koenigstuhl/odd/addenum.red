;redcode
;name Addendum
;author G.Labarga
;assert 1
;strategy	Switch on loss or tie: Oneshot scanner or anti-imp replicator
;strategy	Redcoders Frenzy Tournament, round 14 "Extended '88" .November 2003.
; I haven't optimized oneshot's boot distance. :(
;p-brain
	p_prev equ 489
	p_last equ 490
	strat1 equ boot		;Oneshot scanner
	strat2 equ copy		;anti-imp paper
;Qscan
        qf equ (qgo+1*qs)
        qd equ 135
        qs equ (2*qd)
        qi equ 7                             
        qr equ 7

qbomb   dat <-49,<50
        dat #12*qs      ;a
qp1     dat #5*qs       ;b
qp2     dat #2*qs       ;c
qp3  ;  dat #1*qs       ;d

qgo     cmp qd+qf,      qf ;d
        jmp qskip,      <qf+4

        cmp qd+qf+qs*5, qf+qs*5
        jmp qfast,      <qf+qs*5+4
        cmp qd+qf+qs*12,qf+qs*12
q1      djn qfast,      #qp1

        cmp qd+qf+qs*7, qf+qs*7
        jmp qslow,      <qf+qs*7+4
        cmp qd+qf+qs*14,qf+qs*14
        jmp qslow,      <q1
        cmp qd+qf+qs*10,qf+qs*10
q2      djn qslow,      #qp2
        cmp qd+qf+qs*2, qf+qs*2
        jmp qslow,      <qfast

        cmp qd+qf+qs*8, qf+qs*8
        jmp qslower,    <qf+qs*8+4
        cmp qd+qf+qs*15,qf+qs*15
        jmp qslower,    <q1
        cmp qd+qf+qs*11,qf+qs*11
        jmp qslower,    <q2
        cmp qd+qf+qs*9, qf+qs*9
q3      djn qslower,    #qp3
        cmp qd+qf+qs*3, qf+qs*3
        jmp <qfast,     <qf+qs*3+4
        cmp qd+qf+qs*6, qf+qs*6
        jmp <qfast,     <q2
        cmp qd+qf+qs*4, qf+qs*4
        jmp <qfast,     <q3
        cmp qd+qf+qs*16,qf+qs*16
        slt <q3,        <q1

        jmz res,        qd+qf+qs*8+10

qslower add @q3,        @q2
qslow   add @q2,        qkil
qfast   add @q1,        @qslow
qskip   jmn qloop,      @qkil
        add #qd,        qkil
qloop   mov qbomb,      @qkil
qkil    mov qbomb,      <qf
        sub #qi,        @qloop
        djn qloop,      #7

res: ldp #0,      res
str: ldp pkey,    0
     cmp #1,      res
     add #4000,   str
     stp str,     pkey
     slt #3999,   str
     jmp strat2
pkey:jmp strat1,      #-30

;-------- Oneshot scanner

	osloc equ dbm+1998
	ostep equ 19*7

	dat #0,#0
dbm:	dat <2667,<-15
sbm:	spl 0,<-16
clop:	mov @loop-1,<scan-1
	mov @loop-1,<scan-1
bptr:	djn clop,<dbm-1
	dat #0,#0
for 5
	dat #0,#0
rof
inc:	dat <-(2*ostep),<-(2*ostep)
loop:	sub inc,@clop+1
scan:	cmp (2*ostep)-6,(2*ostep)+1
jump:	jmp <loop,2
	djn loop,@scan
	dat #0,#0
	dat #0,#0		;<- reflection
boot:	mov <bptr+1,osloc-8
src:	mov <jump,<dst
blop:	mov <bptr+1,<boot
	mov <jump,<dst
	mov <bptr+1,<boot
	mov <jump,<dst
	djn blop,#2
dst:	djn osloc,#osloc+3

;---------- '88 anti-imp replicator
	pdest equ 7526
	pstep equ 5966
	atk equ 2421

ctr:	mov #10,@10
copy:	mov <ctr,<ptr
	mov <ctr,<ptr
	jmn copy,ctr
ptr:	spl @0,pdest
	add #pstep,ptr
	spl @ctr,<ctr-2
	mov bmb,<atk
	djn -1,<atk-1-2667
bmb:	dat <2667,<5334

	end qgo




