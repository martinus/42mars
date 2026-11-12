;redcode-94
;name Active D
;author David Houston
;assert 1
;strategy Differentiate with active table!
;strategy
;strategy The polynomial and the number of
;strategy derivatives to take must be stored
;strategy immediately following the warrior
;strategy in the following format:
;strategy
;strategy The first line must be of the form
;strategy "djn.b -3, #N" where N is the number
;strategy of derivatives to take.
;strategy
;strategy The next line must be a "dat 0, 0"
;strategy statement.
;strategy
;strategy The remaining lines constitute the
;strategy polynomial. Each line must be of the
;strategy form "mul.ba #A_n, #n" where A_n
;strategy is the coefficient on the x^n term.
;strategy The terms must be listed in decreasing
;strategy order, starting with the highest
;strategy exponent. Every term in the polynomial
;strategy must be present in the table, even if
;strategy the coefficient is zero. Extra terms
;strategy of the form 0 * x^0 are permitted
;strategy at the end of the polynomial.
;strategy
;strategy The result of the computation will be
;strategy stored in the same format.
;strategy
;strategy The commented lines constitute the
;strategy table entries to instruct the warrior
;strategy to compute the third derivative of the
;strategy polynomial
;strategy x^5 + 6x^3 + 4x + 3

org go

go spl 5
mov.a #3, dec
dec djn.b #3, }0

djn.b -3, #3
dat 0 ,0
mul.ba #2, #5	;1 * x^5
mul.ba #1, #4	;0 * x^4
mul.ba #0, #3	;6 * x^3
mul.ba #2, #2	;0 * x^2
mul.ba #4, #1	;4 * x^1
mul.ba #3, #0	;3 * x^0

;mul.ba #0, #0	;0 * x^0 ; optional line

end

