;redcode-nano
;assert 1
;author hwm
;name the reason
;strategy is ideas for papers
pbomb1 equ 27
pbomb2 equ 17
pbomb3 equ pbomb2+ptr 
x equ 3
y equ pbomb1-x
z equ 17

org boot

boot spl.b # -34, >pbomb1
     spl.b #  38, >pbomb3
ptr  mov.i }   x, >pbomb2
imp  mov.i #   y, } ptr
ptr2 mov.i }   z, > -31
end
