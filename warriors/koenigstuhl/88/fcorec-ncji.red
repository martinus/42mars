;redcode
;name Flarecore C ncji
;author Steve Gunnell
;strategy qscan -> incendiary bomber -> clear
;assert CORESIZE == 8000

;kill Flarecore C
;password nlmyffzsbu

step    equ 5766
time    equ 3931
mark    equ 7612
off     equ 6
away    equ 4059
cstar   equ 7991
gate    equ fuse-4
IMP     equ 2667

b2	spl	0	, 1
b1	jmp	-1	, 1
igo	mov	b1	, @(fuse-(step*time))
	add	#step	, igo
	mov	b2	, @igo
fuse	jmp	igo	, <mark
flop	mov	b3	, <b3+off
    for 0
	mov	b3	, <b3+off
    rof
	jmp	flop	, <gate
b3	dat <IMP+IMP, <IMP
boot	mov	<boot1	, <boot2
	mov	<boot1	, <boot2
    for 0
	mov	<boot1	, <boot2
    rof
	mov	<boot1	, <boot2
boot2	mov	#cstar	, @away
	mov	<boot1	, <boot2
	djn	-1	, #4
boot1	spl	@boot2	, #boot
	mov	<boot1	, <boot2
	mov	<boot1	, <boot2
	sub	boot2	, boot2

    for MAXLENGTH-CURLINE-37
	dat	#0	, #qbomb
    rof
;.............. QScan .....................................;
qs      equ     (qd+qd)
qd      equ     6372
qbinc   equ     (0-16)
qbhop   equ     10
qbtime  equ     28
nil     equ     boot+100

qscan   cmp     2*qs+qd         , 2*qs
qt1     jmp     qa0             , < 3*qs
        cmp     qscan+ 5*qs+qd  , qscan+ 5*qs
qt2     jmp     qa1             , < 4*qs
        cmp     qscan+ 4*qs+qd  , qscan+ 4*qs
qs1     djn     qa1             , # qt1
        cmp     qscan+10*qs-2   , qscan+10*qs+qd-2
qs2     djn     qa2             , # qt2
        cmp     qscan+ 9*qs+qd  , qscan+ 9*qs
qt3     jmp     qa2             , < 6*qs
        cmp     qscan+ 6*qs+qd  , qscan+ 6*qs
        jmp     qa2             , < qa1
        cmp     qscan+ 8*qs+qd  , qscan+ 8*qs
        jmp     qa2             , < qs1
        cmp     qscan+11*qs     , qscan+11*qs+qd
        jmp     qa3             , < qa2
        cmp     qscan+18*qs-8   , qscan+18*qs+qd-8
qs3     djn     qa3             , # qt3
        cmp     qscan+16*qs-2   , qscan+16*qs+qd-2
        jmp     qa3             , < qs2
        cmp     qscan+12*qs     , qscan+12*qs+qd
        jmp     qa3             , < qa1
        cmp     qscan+14*qs     , qscan+14*qs+qd
        jmp     qa3             , < qs1
        jmz     boot            , qscan+15*qs

qa3     add     @ qs3           , qp
qa2     add     @ qs2           , @ qa3
qa1     add     @ qs1           , @ qa3
qa0     cmp     @ qp            , nil
        cmp     @ 0             , 0
        add     # qd            , qp
ql      mov       qbomb         , @ qp
qp      mov       nil           , < qscan+2*qs
        add     # qbinc         , @ ql
        djn       ql            , # qbtime
        jmp       boot          , 0
qbomb   dat     # 0             , # qbhop

end     qscan

