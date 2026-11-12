;redcode-94
;name Quick Bomb
;author Samuel Owens
;strategy 50c color, 50c swap, 50% imp gate
;assert 1
 
data       dat #150, #0
start quick
           mov <data, }data
           djn -1, <start -3
           jmp -1, {data
end quick

