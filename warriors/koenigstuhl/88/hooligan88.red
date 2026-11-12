;redcode-88
;name 	Hooligan'88
;author G.Labarga
;assert CORESIZE==8000

;strategy	Blur-style scanner, 88Draft

	cmod equ 4
	step equ 19*2*cmod
	gate equ loop-2
	;decoy equ scan-2204

loop:	mov smb,<ptr
scan:	cmp <step-cmod,<step
	mov -1,ptr
	sub inc,scan
	jmn loop,scan
smb:	spl 0,<1-step
clop:	mov inc,<gate
	djn clop,<gate-1
inc:	dat <-step,<-step
ptr:	dat <2667,<4000

	end scan

for 79
	dat 0,0
rof
	seq.i }92,}88
	djn.f -1,{decoy+8-4
start:	mov.i {decoy+1,<decoy+7		;transparent ~3c decoy maker
	mov.i {decoy+2,<decoy+6
	mov.i <decoy+3,{decoy+10
	djn.f scan,<decoy+14
	jmp scan,<decoy+15

	end start

