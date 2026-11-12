;redcode-nano
;assert CORESIZE==80
;author hwm
;name Old Lamplights Blink
;strategy old time coreclear

x1 equ (CORESIZE-10)
x2 equ (CORESIZE/2)
dist equ -5
paper spl.i  # 11, < x2+4
      mov.i  < x1-7, } paper
      mov.i  > x1-6, < x1-8
      mov.i  > 28, { dist
      mov.i  > 19, < x2
end

