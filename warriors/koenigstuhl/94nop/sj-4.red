;redcode-94
;name SJ-4
;author J.Layland
;strategy  Leprechaun-like SPL-JMP bomber, 2-pass clear, gate
;assert CORESIZE==8000

;macro
	
inc equ -16*7	; mod 16 bomb		
offset equ 24	; mod 8 overall
; b equ scan-offset

bomb dat <b-loc, #0
for 47
dat 0,0
rof

b dat 0,0	; scan-offset
for 21
dat 0,0
rof

start add #inc, scan
mov j1, @scan
scan jmz -2, @test+offset
mov scan, @2	; dec protected
test mov j2, @b
mov s, <b
jmn start, test 

s   spl 0, <b+1-loc	; b+1-loc = -47
    mov @b, <loc
j2  jmp -1,  0
j1  jmp -offset, -offset

for 16 
dat 0,0
rof
loc dat #bomb

end start

