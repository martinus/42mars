;redcode-94
;name Nano
;author Zul Nadzri
;assert 1

;------------------------------ The Components ------------------------------
w1 equ gate
w2 equ imp
w3 equ clear

gate: jmp #0,<-3
ptr equ clear-3
clear: mov bmb,}ptr ;<-- must start here
mov bmb,}ptr
jmp -2
bmb: dat 7,0
imp: mov.i #4,1
;----------------------------------------------------------------------------

result	ldp #0, #0			;result

detour	seq #-1, result
		jmp teststat
		stp #1, #451
		stp #1, #452
		stp #1, #453
		stp #1, #454
		stp #1, #455
		stp #1, #456
		stp #1, #480
		stp #1, #481
		stp #1, #482
		stp #1, #457	
		jmp w1

teststat	ldp #451, #0		;test on or off					<1>
testwar	ldp #452, #0		;test warrior used				<1>
curbank	ldp #453, #0		;current bank sequence				<1>
maxbank	ldp #454, #0		;max or cumulative warrior in bank		<1>
curseq	ldp #455, #0		;current sequence					<1>
bankseq	ldp #456, #0		;current bank sequence				<1>
		ldp #480, #0		;incr table
		ldp #481, #0		;table A
		ldp #482, #0		;table B

quickie	ldp #457, #0		;first round detour
		sne #2, quickie		;max jammer warrior =11    !!!!!
		jmp start
		add #1,quickie
		mov.ba quickie,1
		stp #0, #457
		add.ba quickie, qptr
		mov *qptr, exec		
		jmp exec2

start		seq #1, teststat
test_off	jmp testoff
teston	seq #1, testwar
		jmp incrtable		
testwar1	seq #1, result
testw1lost	jmp incrtable
testw1won	stp #0, #451
		seq.b curseq, maxbank
		jmp seqless
seqsame	add #1, curseq
		mov.ba curseq, 1
		stp #0, #455
;		stp.b #1, curseq		;put warrior1 at current sequence if seq > maxbank
		add.a #1, exec		;put w1 at exec [to be eliminated]
		jmp exec2
seqless	add #1, curseq
		mov.ba curseq, 1
		stp #0, #455
		mov.ba curseq, 1	
		ldp #0, #0		;load next recorded warrior
		add.ba -1, exec
		jmp exec2

testoff	seq #1, result
		jmp lost
won		slt.b maxbank, curseq
		jmp bankless
bankmore	add #1, bankseq		;maxbank > seq eg  3 > 2
		mov.ba bankseq, 1
		stp #0, #456
bankwar	ldp.b bankseq, #0
		add #1, curseq
		mov.ba curseq, 1
		stp #0, #455
		add.ba bankwar, exec
		jmp exec2
bankless	add #1, curseq
		seq.b maxbank, bankseq
		sub.b maxbank, bankseq
		add #1, bankseq
		mov.ba bankseq, 1
		stp #0, #456
		mov.ba testwar, 2
		mov.b curseq, 1
		stp #0, #0
bankwarz	ldp.b bankseq, #0
		add.ba bankwarz, exec
		jmp exec2

lost		slt.b maxbank, curseq
		jmp curseqb
curseqs	stp #1, #451
		stp #1, #452
		stp #1, #453
		stp #1, #455
		stp #1, #456
		jmp incrtable
curseqb	mov.ba curseq, 2
		mov.b maxbank, 1
		stp #0, #0
		seq #2, testwar
		sub #1, 2
		mov.b curseq, 1
		stp #2, #0
		jmp curseqs	

maxtable	equ 6
incrtable	ldp #480, #0			;which table it is now
		ldp #481, #0		;table A-spec
		ldp #482, #0		;table B-spec
		add.ba -3, incrt
		add.ba -3, tablea
		add.ba -3, tableb
		sne #maxtable, incrtable	;6 = table?
		jmp table6
tableachk	sne.a #0, tablea	
		jmp tablebchk
tableaok	sub.a #1, tablea
tablea	stp #0, #481
		add.a #1, exec		;put w1 at exec
		stp #1, #452
		jmp exec2
tablebchk	sne.a #0, tableb
		jmp nexttable
tablebok	sub.a #1, tableb
tableb	stp #0, #482
		add.a #2, exec		;put w2 at exec
		stp #2, #452
		jmp exec2
nexttable	add.a #1, incrt
incrt		stp #0, #480
		mov.a incrt, 1
		stp #0, #481
		mov.a incrt, 1
		stp #0, #482
		jmp incrtable
table6	seq #1, result
		stp #0, #480
		add.a #3, exec
		jmp exec2

exec		jmp.a 0, }0
		jmp w1
		jmp w2
		jmp w3

exec2		ldp #451, #0		;test only
		ldp #452, #0		
		ldp #453, #0		
		ldp #454, #0		
		ldp #455, #0		
		ldp #456, #0		
		ldp #480, #0
		ldp #481, #0
		ldp #482, #0
		ldp #457, #0
		jmp exec

qptr		dat 0,0			;radar jammer
		jmp 1
		jmp 2
		jmp 3
		jmp 1
		jmp 3
		jmp 2
		jmp 2
		jmp 1
		jmp 3
		jmp 2
		jmp 1


end result
;end exec