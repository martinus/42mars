;redcode-94
;name Anti-spiral sniper
;author Neogryzor
;strategy	Anti-spiral for Mini-challenge #3
;strategy	~99'5% wins
;assert 1

START:	djn #0,#50	;wait spiral launch. Not needed at all, but improves the score.
	JMZ #0,<PTR	;Find where the spiral is
	ADD #2667,PTR
	JMN -1,@PTR	;Identify spiral's head
	JMZ #0,@PTR	;Waits the spiral's 8th process execution
	SUB #3*2667,PTR	;Now we know where the spiral is and wich proc. is executing
PTR:	MOV BMB,-10	; just drop the bomb over the next executed instruction, (third process)
	JMP #0
BMB:	MOV.I #0,>2667	;The 3rd. proc kills 4th and moves the bomb to 5th proc
			;all remainig procs. will be killing themselves
	END START


