;redcode
;name SlowButSmallSpliter
;author Lukasz Adamowski
;assert 1

NumberOfProcesses	EQU	2

count
	jmn	0,	#NumberOfProcesses
	mov	1,	split
	dat	0,	0
start
	spl	count,	<count
split
	spl	0,	<count
	jmn	0,	-1

; Start of proper warrior
	jmp 0

	end	start

