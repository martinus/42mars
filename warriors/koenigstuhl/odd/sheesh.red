;redcode
;name Sheesh..
;author Miz
;strategy Though i am going to lose, why
;strategy not try something anyway..
;assert 1

clear: add.ab #10, 2
 mov.i -2, <ptr
 djn.b -1, #0
start: sne.i <ptr, <ptr
 jmz.f -1, <ptr
 jmn.a clear, @ptr
 mov.i j, >ptr
 mov.i j, >ptr
 sub.ab #25, ptr
ptr: jmp clear, #-50
j jmp #0
end start
