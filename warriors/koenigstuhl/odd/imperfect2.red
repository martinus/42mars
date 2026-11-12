;redcode-RF19 
;name Imperfect II
;author LAchi
;assert 1

boot	djn.f  #0, <-10
	spl -1
	
news	mov bomb, 0
; suicidal .5c bomber

start mov  bomb  , @dest
dest  mov  bomb  , @ 3364-1
      add #3364*2,  dest
      jmp  start
bomb  dat #     0, # 3364

      end boot

