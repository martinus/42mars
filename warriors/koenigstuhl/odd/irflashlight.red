;redcode-rf23
;name IR-Flashlight
;author G.Labarga
;assert 1
;strategy A simple jumping stun bomber
;strategy Not bad

where equ 11800

ptr:	mov #13,#13
setp:	mov #12000,ref
	djn loop,#160
	nop gap,{loop	;jmp/dat bomb switch
loop:	mov bm,@ref
ref:	mov *-1,}12000
gap:	add.ab 2,ref
	jmn *ref,ref	;-2,-2
copy:	mov <ptr,{dst	;-8,2
	jmn copy,ptr
dst:	jmp where
	dat >3,}1
bm:	jmp #4,>-81

end loop



