;redcode-88
;name Stunner
;author Zul Nadzri
;strategy Round 18 Frenzy Tournament
;strategy Stun and Win
;assert 1

bomb	add <-1, bot+100
qbomb	djn $0, #0

;------- Stun -------
	add #5, bomb
start	mov qbomb, @bomb
	djn -2, #1550

;------- Seek ----------
	add #11, bot+99
	add #11, bot+98
	add #13, bomb
adj2	add #1, bomb
adj	add #-5, bomb
	jmz -1, @bomb
	add #-1, bomb
	jmz adj2, @bomb
k	cmp #11, @bomb
	jmp 2
	add #-250, bomb

;------- Kill --------
	add #6, bomb
	mov bot, <bomb
	djn -1, #5
	add #5, -1
	jmp adj

;------- Ptr ---------
bot	dat #0, #0

end start
