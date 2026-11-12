;redcode-88
;name The Hurricaner (b)
;author G.Labarga
;assert 1
;strategy Qscan->stone/paperclear
;strategy Optimaxed
;archivo sp88best, (optimax)
;strategy '88 warrior
;much more agressive stone
;the paper seems to be strong enough
; creo que el sto es peor individual
;----- stone
step equ ( 4279 *4)
d2 equ -(1*step)	;1+(2*step)
trail equ 7465
stloc equ boot+ 5044
;----- paper
plcd1 equ 7191
plcd2 equ 2282
patk equ 1543

boot:	mov <ssrc,<sgo
ssrc:	spl 1,sto+7
	mov <ssrc,<sgo
sgo:	spl 1,stloc
	mov <ssrc,<sgo
	djn @sgo,#3 ;<- 4?

lch:	spl 1
	spl 1
	spl 1
paper:	mov <8 ,<1	;fast spreading head
	spl @0,plcd1
ptr:	mov #8,@8
	mov <ptr,<1
	spl @0,plcd2
	spl @ptr,<-1
	mov 0,<1
	djn -1,#patk

sto:	spl 0
	spl 0,<2-step
ref:	mov bmb,<d2		;turns into clear
	mov bmb,@ref
	sub #(2*step),-2 ;@-1
	djn @-2,<trail
bmb:	dat <1-step,<1-step	;perfect gate endgame

qs   equ 322 
qd   equ 161 

qscan cmp 2*qs+qd      , 2*qs 
qt1  jmp qa0           , <3*qs 
     cmp qscan+5*qs+qd , qscan+5*qs 
qt2  jmp qa1           , <4*qs 
     cmp qscan+4*qs+qd , qscan+4*qs 
qs1  djn qa1           , #qt1 
     cmp qscan+10*qs-2 , qscan+10*qs+qd-2
qs2  djn qa2           , #qt2 
     cmp qscan+9*qs+qd , qscan+9*qs 
qt3  jmp qa2           , <6*qs 
     cmp qscan+6*qs+qd , qscan+6*qs 
     jmp qa2           , <qa1 
     cmp qscan+8*qs+qd , qscan+8*qs 
     jmp qa2           , <qs1 
     cmp qscan+11*qs   , qscan+11*qs+qd 
     jmp qa3           , <qa2 
     cmp qscan+18*qs-8 , qscan+18*qs+qd-8
qs3  djn qa3           , #qt3 
     cmp qscan+16*qs-2 , qscan+16*qs+qd-2 
     jmp qa3           , <qs2 
     cmp qscan+12*qs   , qscan+12*qs+qd 
     jmp qa3           , <qa1 
     cmp qscan+14*qs   , qscan+14*qs+qd 
     jmp qa3           , <qs1 
     jmz boot          , qscan+15*qs 

qa3  add @qs3          , qp 
qa2  add @qs2          , @qa3 
qa1  add @qs1          , @qa3 
qa0  cmp @qp           , <1234 
     cmp @0            , 0 
     add #qd           , qp 
ql   mov qb            , @qp 
qp   mov <2345         , <qscan+2*qs 
     add #9            , @ql 		;slight changes
     djn ql            , #6
     jmp boot          , <43 
qb:  dat <1,<-63
     end qscan

